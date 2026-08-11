import { useEffect, useRef } from "react";

import { useGameProgressStore } from "@/games/progress-store";
import { gameProgressApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export function useGameProgressSync() {
  const accessToken = useAppStore((state) => state.accessToken);
  const authMode = useAppStore((state) => state.authMode);
  const hydrated = useGameProgressStore((state) => state.hydrated);
  const games = useGameProgressStore((state) => state.games);
  const mergeRemote = useGameProgressStore((state) => state.mergeRemote);
  const readyToken = useRef<string | null>(null);
  const latestGames = useRef(games);

  useEffect(() => {
    latestGames.current = games;
  }, [games]);

  useEffect(() => {
    if (!hydrated || authMode !== "authenticated" || !accessToken) {
      readyToken.current = null;
      return;
    }
    let cancelled = false;
    readyToken.current = null;
    gameProgressApi
      .get(accessToken)
      .then(({ games: remote }) => {
        if (cancelled) return;
        const merged = mergeRemote(remote);
        readyToken.current = accessToken;
        return gameProgressApi.put(merged, accessToken);
      })
      .catch(() => {
        if (!cancelled) readyToken.current = accessToken;
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, authMode, hydrated, mergeRemote]);

  useEffect(() => {
    if (!accessToken || readyToken.current !== accessToken) return;
    const timeout = setTimeout(() => {
      gameProgressApi.put(latestGames.current, accessToken).catch(() => undefined);
    }, 700);
    return () => clearTimeout(timeout);
  }, [accessToken, games]);
}
