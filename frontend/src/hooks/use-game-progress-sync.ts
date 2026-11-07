import { useEffect } from "react";
import { AppState } from "react-native";
import { createProgressSyncQueue } from "@/lib/progress-sync-queue";

import { useGameProgressStore } from "@/games/progress-store";
import { gameProgressApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import type { GamesProgress } from "@/games/progress-store";

// Preserve device records from the removed experiment, but don't send keys
// unsupported by the server. Existing games retain their normal synchronization.
const removedLocalKeys = new Set(["bottle-flip", "snake", "minesweeper", "mini-sudoku", "fifteen", "tic-tac-toe", "connect-four", "memory-pairs", "simon", "lights-out", "mastermind"]);
function serverGameProgress(games: GamesProgress): GamesProgress {
  return Object.fromEntries(Object.entries(games).filter(([key]) => !removedLocalKeys.has(key))) as GamesProgress;
}

export function useGameProgressSync() {
  const authenticated=useAppStore(state=>state.authMode==="authenticated"&&Boolean(state.accessToken));
  const accountId=useAppStore(state=>state.user.id);
  const hydrated=useGameProgressStore(state=>state.hydrated);
  const mergeRemote=useGameProgressStore(state=>state.mergeRemote);
  useEffect(()=>{
    if(!hydrated||!authenticated)return;
    let cancelled=false,ready=false,loading=false,retry=5000;
    let retryTimer:ReturnType<typeof setTimeout>|undefined;
    const currentToken=()=>{const state=useAppStore.getState();return state.authMode==="authenticated"&&state.user.id===accountId?state.accessToken:null;};
    const queue=createProgressSyncQueue<GamesProgress>(async value=>{const token=currentToken();if(!token)throw new Error("Account changed");await gameProgressApi.put(value,token);});
    const load=async()=>{
      const token=currentToken();if(cancelled||loading||!token)return;loading=true;
      try{
        const {games:remote}=await gameProgressApi.get(token);if(cancelled||!currentToken())return;
        queue.markSynced(serverGameProgress(remote));const merged=mergeRemote(remote);ready=true;queue.schedule(serverGameProgress(merged));
      }catch{if(!cancelled){retryTimer=setTimeout(()=>void load(),retry);retry=Math.min(60000,retry*2);}}
      finally{loading=false;}
    };
    // Subscribe outside React rendering: saves must not re-render the catalog.
    const unsubscribe=useGameProgressStore.subscribe((next,previous)=>{if(ready&&next.games!==previous.games)queue.schedule(serverGameProgress(next.games));});
    const subscription=AppState.addEventListener("change",state=>{if(state==="active"&&!ready){if(retryTimer)clearTimeout(retryTimer);void load();}else if(ready)void queue.flush();});
    void load();
    return()=>{cancelled=true;if(retryTimer)clearTimeout(retryTimer);unsubscribe();subscription.remove();queue.dispose();};
  },[accountId,authenticated,hydrated,mergeRemote]);
}
