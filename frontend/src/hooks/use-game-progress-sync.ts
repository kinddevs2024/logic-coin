import { useEffect } from "react";
import { AppState } from "react-native";

import { useGameProgressStore, type GamesProgress } from "@/games/progress-store";
import { gameProgressApi } from "@/lib/api";
import { createProgressSyncCooldown, createProgressSyncQueue } from "@/lib/progress-sync-queue";
import { progressSyncSnapshot } from "@/lib/progress-sync-snapshot";
import { useAppStore } from "@/store/app-store";

const saveIntervalMs = 15_000;
const saveRetryMs = 30_000;
const maxTimerDelayMs = 2_147_483_647;
// Navigating away and returning must not reset the server's retry deadline.
const cooldown = createProgressSyncCooldown();

export function useGameProgressSync() {
  const authenticated = useAppStore(state => state.authMode === "authenticated" && Boolean(state.accessToken));
  const accountId = useAppStore(state => state.user.id);
  const hydrated = useGameProgressStore(state => state.hydrated);
  const mergeRemote = useGameProgressStore(state => state.mergeRemote);

  useEffect(() => {
    if (!hydrated || !authenticated || !accountId) return;
    let cancelled = false;
    let ready = false;
    let loading = false;
    let loadRetryAt = 0;
    let loadRetryMs = 5_000;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const currentToken = () => {
      const state = useAppStore.getState();
      return state.authMode === "authenticated" && state.user.id === accountId ? state.accessToken : null;
    };
    const resumeAt = () => cooldown.until(accountId);
    const queue = createProgressSyncQueue<GamesProgress>(async value => {
      const token = currentToken();
      if (!token) throw new Error("Account changed");
      try {
        await gameProgressApi.put(value, token);
      } catch (error) {
        if (currentToken()) cooldown.hold(accountId, error);
        throw error;
      }
    }, saveIntervalMs, saveRetryMs, resumeAt);

    const scheduleLoad = () => {
      if (retryTimer !== undefined) return;
      const delay = Math.max(loadRetryAt, resumeAt()) - Date.now();
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void load();
      }, Math.min(Math.max(0, delay), maxTimerDelayMs));
    };

    const load = async () => {
      const token = currentToken();
      if (cancelled || ready || loading || !token) return;
      if (Math.max(loadRetryAt, resumeAt()) > Date.now()) {
        scheduleLoad();
        return;
      }
      loading = true;
      try {
        const { games: remote } = await gameProgressApi.get(token);
        if (cancelled || !currentToken()) return;
        queue.markSynced(progressSyncSnapshot(remote));
        const merged = mergeRemote(remote);
        ready = true;
        queue.schedule(progressSyncSnapshot(merged));
      } catch (error) {
        if (currentToken()) cooldown.hold(accountId, error);
        if (!cancelled) {
          loadRetryAt = Date.now() + loadRetryMs;
          loadRetryMs = Math.min(60_000, loadRetryMs * 2);
          scheduleLoad();
        }
      } finally {
        loading = false;
      }
    };

    // Subscribe outside React rendering: saves must not re-render the catalog.
    const unsubscribe = useGameProgressStore.subscribe((next, previous) => {
      if (ready && next.games !== previous.games) queue.schedule(progressSyncSnapshot(next.games));
    });
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active" && !ready) void load();
      if (ready && (state === "active" || state === "background")) void queue.flush();
    });
    void load();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      unsubscribe();
      subscription.remove();
      queue.dispose();
    };
  }, [accountId, authenticated, hydrated, mergeRemote]);
}
