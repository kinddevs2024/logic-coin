import { useRafflePause } from "./raffle-provider";
import { useEffect, useRef } from "react";
import { usePathname } from "expo-router";
import { AppState, Platform, type AppStateStatus } from "react-native";

import { isAdNavigationScreen, shouldShowNavigationAd } from "@/lib/ad-navigation";
import { APP_OPEN_BACKGROUND_MS } from "@/lib/ad-pressure";

import { rewardedAds } from "@/lib/rewarded-ad";
import { useAppStore } from "@/store/app-store";

export function AdRuntime() {
  const rafflePaused = useRafflePause();
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  currentPath.current = pathname;
  const previousPath = useRef<string | null>(null);
  const startupAttempted = useRef(false);
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
    if (Platform.OS === "web" || !hydrated || authMode !== "authenticated" || !userId || rafflePaused || !isAdNavigationScreen(pathname) || startupAttempted.current) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void rewardedAds.initialize(userId).then(async ready => {
        if (!ready || cancelled || AppState.currentState !== "active") return;
        startupAttempted.current = true;
        await rewardedAds.showAppOpen();
      }).catch(() => false);
    }, 2000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [authMode, hydrated, pathname, rafflePaused, userId]);

  useEffect(() => {
    if (!hydrated || authMode !== "authenticated") { previousPath.current = null; return; }
    const previous = previousPath.current;
    previousPath.current = pathname;
    if (rafflePaused || !shouldShowNavigationAd(previous, pathname)) return;
    const timer = setTimeout(() => {
      if (AppState.currentState === "active") void rewardedAds.showInterstitial("navigation-frequency").catch(() => false);
    }, 350);
    return () => clearTimeout(timer);
  }, [authMode, hydrated, pathname, rafflePaused]);

  useEffect(() => {
    if (!hydrated || !authMode || authMode === "guest") return;
    let previousState: AppStateStatus = AppState.currentState;
    let backgroundAt: number | null = null;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" && backgroundAt === null) backgroundAt = Date.now();
      if (previousState.match(/inactive|background/) && nextState === "active") {
        const elapsed = backgroundAt === null ? 0 : Date.now() - backgroundAt;
        backgroundAt = null;
        if (!rafflePaused && isAdNavigationScreen(currentPath.current) && elapsed >= APP_OPEN_BACKGROUND_MS) void rewardedAds.showAppOpen().catch(() => false);
      }
      previousState = nextState;
    });
    return () => subscription.remove();
  }, [authMode, hydrated, rafflePaused]);

  return null;
}
