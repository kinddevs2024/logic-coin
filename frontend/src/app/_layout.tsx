import "react-native-reanimated";
import "../global.css";
import "@/lib/referral-attribution";

import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppearanceTransition } from "@/components/appearance-transition";
import { AdRuntime } from "@/components/ad-runtime";
import { RewardBurst } from "@/components/reward-burst";
import { ContestRewardModal } from "@/components/contest-reward-modal";
import { WebAnalytics } from "@/components/web-analytics";
import { useGameProgressStore } from "@/games/progress-store";
import { useAppTheme } from "@/hooks/use-app-theme";
import { configureDailyReminder, syncPushNotifications } from "@/lib/notifications";
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
    let timeout = 0;
    const rehydrate = () => {
      timeout = window.setTimeout(() => {
        void useAppStore.persist.rehydrate();
        void useGameProgressStore.persist.rehydrate();
      }, 1500);
    };
    if (document.readyState === "complete") rehydrate();
    else window.addEventListener("load", rehydrate, { once: true });
    return () => {
      window.removeEventListener("load", rehydrate);
      window.clearTimeout(timeout);
    };
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
        await Promise.all(registrations.map((registration) => registration.unregister()));
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
      const localReady = await configureDailyReminder(
        notificationsEnabled,
        notificationTime,
        language,
      );
      if (authMode === "authenticated" && accessToken) {
        await syncPushNotifications({
          accessToken,
          enabled: notificationsEnabled && localReady,
          reminderTime: notificationTime,
        });
      }
    })().catch(() => {});
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
          <WebAnalytics />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
