import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";

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
      .then(() => rewardedAds.showAppOpen())
      .catch(() => false);
  }, [authMode, hydrated, userId]);

  useEffect(() => {
    if (!hydrated || !authMode || authMode === "guest") return;
    let previousState: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (previousState.match(/inactive|background/) && nextState === "active") {
        void rewardedAds.showAppOpen();
      }
      previousState = nextState;
    });
    return () => subscription.remove();
  }, [authMode, hydrated]);

  return null;
}
