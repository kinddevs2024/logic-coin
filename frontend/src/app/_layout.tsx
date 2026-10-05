import "react-native-reanimated";
import "../global.css";
import "@/lib/referral-attribution";

import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppearanceTransition } from "@/components/appearance-transition";
import { AdRuntime } from "@/components/ad-runtime";
import { RewardBurst } from "@/components/reward-burst";
import { ContestRewardModal } from "@/components/contest-reward-modal";
import { ChallengeAdOffer } from "@/components/challenge-ad-offer";
import { WebAnalytics } from "@/components/web-analytics";
import { useGameProgressStore } from "@/games/progress-store";
import { useAppTheme } from "@/hooks/use-app-theme";
import { configureDailyReminder, syncPushNotifications, installNotificationHandlers } from "@/lib/notifications";
import { setPushStatus } from "@/lib/push-status";
import { NotificationInbox } from "@/components/notification-inbox";
import { useAppStore } from "@/store/app-store";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const theme = useAppTheme();
  const hydrated = useAppStore((state) => state.hydrated);
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const notificationsEnabled = useAppStore(
    (state) => state.notificationsEnabled,
  );
  const notificationTime = useAppStore((state) => state.notificationTime);
  const language = useAppStore((state) => state.language) ?? "ru";
  const [pushInbox, setPushInbox] = useState(false);

  useEffect(() => {
    if (!hydrated || authMode !== "authenticated") return;
    if (Platform.OS === "web" && new URLSearchParams(window.location.search).get("notifications") === "1") {
      setPushInbox(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("notifications");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void installNotificationHandlers(() => setPushInbox(true), () => {
      const state = useAppStore.getState();
      if (state.accessToken) void syncPushNotifications({ accessToken: state.accessToken, enabled: state.notificationsEnabled, reminderTime: state.notificationTime }).catch(() => setPushStatus("error"));
    }).then(stop => { if (disposed) stop(); else cleanup = stop; }).catch(() => setPushStatus("error"));
    return () => { disposed = true; cleanup?.(); };
  }, [hydrated, authMode]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    // React Query observes browser focus by default. Native polling must pause
    // when Android is backgrounded and resume with the existing freshness rules.
    if (AppState.currentState !== null) {
      focusManager.setFocused(AppState.currentState === "active");
    }
    const subscription = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(state === "active");
    });
    return () => {
      subscription.remove();
      focusManager.setFocused(undefined);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      document.documentElement.dataset.theme = theme.mode;
      document.documentElement.style.colorScheme = theme.mode === "dark" ? "dark" : "light";
      document.body.style.backgroundColor = String(theme.background);
      // Browser chrome keeps the brand blue, independently of the page theme.
      let browserTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!browserTheme) {
        browserTheme = document.createElement("meta");
        browserTheme.name = "theme-color";
        document.head.appendChild(browserTheme);
      }
      browserTheme.content = "#0866FF";
    } else {
      void SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
    }
  }, [theme.background, theme.mode]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    // Restore the session as soon as React mounts. Images/fonts and third-party
    // scripts must not hold the entire app behind window.load or a fixed timer.
    void useAppStore.persist.rehydrate();
    void useGameProgressStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (hydrated) {
      void SplashScreen.hideAsync();
    }
  }, [hydrated]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    document.title = "Logic Coin";
    const tg = (window as unknown as { Telegram?: { WebApp?: { ready?: () => void; expand?: () => void } } }).Telegram?.WebApp;
    if (tg) {
      tg.ready?.();
      tg.expand?.();
    }
    const visualViewport = window.visualViewport;
    let lastViewportSize = "";
    const syncViewportSize = () => {
      const width = Math.round(visualViewport?.width ?? window.innerWidth);
      const height = Math.round(visualViewport?.height ?? window.innerHeight);
      const nextViewportSize = `${width}x${height}`;
      if (nextViewportSize === lastViewportSize) return;
      lastViewportSize = nextViewportSize;
      // Telegram can resize only visualViewport when its chrome collapses.
      // Notify React Native Web so games recalculate height-based layouts.
      window.dispatchEvent(new Event("resize"));
    };
    visualViewport?.addEventListener("resize", syncViewportSize);
    window.addEventListener("orientationchange", syncViewportSize);
    const firstSync = window.setTimeout(syncViewportSize, 120);
    const secondSync = window.setTimeout(syncViewportSize, 650);
    return () => {
      visualViewport?.removeEventListener("resize", syncViewportSize);
      window.removeEventListener("orientationchange", syncViewportSize);
      window.clearTimeout(firstSync);
      window.clearTimeout(secondSync);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      document.documentElement.lang = language;
    }
  }, [language]);

  useEffect(() => {
    if (Platform.OS !== "web" || !("serviceWorker" in navigator)) return;

    // The former shell worker could keep an old HTML document while its hashed
    // JS/CSS files had already been replaced by a new Vercel deployment. Clear
    // it once so production always loads one coherent deployment.
    void navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        await Promise.all(registrations.filter(registration => {
          const script = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL;
          return script && new URL(script).pathname !== "/push-sw.js";
        }).map((registration) => registration.unregister()));
        if ("caches" in globalThis) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key.startsWith("logic-coin-shell-"))
              .map((key) => caches.delete(key)),
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated || !authMode) return;
    void (async () => {
      await configureDailyReminder(
        notificationsEnabled,
        notificationTime,
        language,
      );
      if (authMode === "authenticated" && accessToken) {
        await syncPushNotifications({
          accessToken,
          enabled: notificationsEnabled,
          reminderTime: notificationTime,
        });
      }
    })().catch(() => setPushStatus("error"));
  }, [
    accessToken,
    authMode,
    hydrated,
    language,
    notificationTime,
    notificationsEnabled,
  ]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
          <Stack
            screenOptions={{
              title: "Logic Coin",
              headerShown: false,
              animation: Platform.OS === "web" ? "fade" : "slide_from_right",
              contentStyle: { backgroundColor: theme.background },
            }}
          />
          <AppearanceTransition />
          <AdRuntime />
          <RewardBurst />
          <ContestRewardModal />
          <ChallengeAdOffer />
          {pushInbox && authMode === "authenticated" ? <NotificationInbox onClose={() => setPushInbox(false)} /> : null}
          <WebAnalytics />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
