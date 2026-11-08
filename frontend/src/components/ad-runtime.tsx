import { useRafflePause } from "./raffle-provider";
import { useCallback, useEffect, useRef } from "react";
import { useGlobalSearchParams, usePathname } from "expo-router";
import { AppState, Platform, type AppStateStatus } from "react-native";

import { adNavigationKey, createNavigationAdCounter, isAdNavigationScreen, shouldShowNavigationAd, subscribeProfileAdNavigation } from "@/lib/ad-navigation";
import { APP_OPEN_BACKGROUND_MS } from "@/lib/ad-pressure";

import { rewardedAds } from "@/lib/rewarded-ad";
import { useAppStore } from "@/store/app-store";

export function AdRuntime() {
  const rafflePaused = useRafflePause();
  const pathname = usePathname();
  const { chat } = useGlobalSearchParams<{ chat?: string | string[] }>();
  const navigationKey = adNavigationKey(pathname, chat);
  const currentPath = useRef(pathname);
  useEffect(() => { currentPath.current = pathname; }, [pathname]);
  const previousPath = useRef<string | null>(null);
  const navigationCounter = useRef(createNavigationAdCounter());
  const navigationShowing = useRef(false);
  const startupAttempted = useRef(false);
  const hydrated = useAppStore((state) => state.hydrated);
  const authMode = useAppStore((state) => state.authMode);
  const userId = useAppStore((state) => state.user.id);
  const requestNavigationAd = useCallback(async () => {
    if (navigationShowing.current || AppState.currentState !== "active") return;
    navigationShowing.current = true;
    try {
      if (await rewardedAds.showInterstitial("navigation-frequency")) navigationCounter.current.shown();
    } catch { /* An unavailable ad never blocks navigation. Retry at a later boundary. */ }
    finally { navigationShowing.current = false; }
  }, []);

  useEffect(() => {
    previousPath.current = null;
    navigationCounter.current.reset();
  }, [userId, authMode]);

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
    if (!hydrated || authMode !== "authenticated") { previousPath.current = null; navigationCounter.current.reset(); return; }
    const previous = previousPath.current;
    previousPath.current = navigationKey;
    if (rafflePaused || !shouldShowNavigationAd(previous, navigationKey)) return;
    if (navigationCounter.current.advance()) void requestNavigationAd();
  }, [authMode, hydrated, navigationKey, rafflePaused, requestNavigationAd]);

  useEffect(() => subscribeProfileAdNavigation(() => {
    if (!hydrated || authMode !== "authenticated" || rafflePaused) return;
    if (navigationCounter.current.advance()) void requestNavigationAd();
  }), [authMode, hydrated, rafflePaused, requestNavigationAd]);

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
