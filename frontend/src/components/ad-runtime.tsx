import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { APP_OPEN_BACKGROUND_MS } from "@/lib/ad-pressure";

import { rewardedAds } from "@/lib/rewarded-ad";
import { useAppStore } from "@/store/app-store";

export function AdRuntime() {
  const hydrated = useAppStore((state) => state.hydrated);
  const authMode = useAppStore((state) => state.authMode);
  const userId = useAppStore((state) => state.user.id);

  useEffect(() => {
    if (!hydrated || !authMode) return;
    if (authMode === "authenticated" && !userId) return;
    void rewardedAds
      .initialize(userId)
      .catch(() => false);
  }, [authMode, hydrated, userId]);

  useEffect(() => {
    if (!hydrated || !authMode || authMode === "guest") return;
    let previousState: AppStateStatus = AppState.currentState;
    let backgroundAt: number | null = null;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" && backgroundAt === null) backgroundAt = Date.now();
      if (previousState.match(/inactive|background/) && nextState === "active") {
        const elapsed = backgroundAt === null ? 0 : Date.now() - backgroundAt;
        backgroundAt = null;
        if (elapsed >= APP_OPEN_BACKGROUND_MS) void rewardedAds.showAppOpen().catch(() => false);
      }
      previousState = nextState;
    });
    return () => subscription.remove();
  }, [authMode, hydrated]);

  return null;
}
