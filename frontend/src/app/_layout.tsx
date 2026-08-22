import "react-native-reanimated";
import "../global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AppearanceTransition } from "@/components/appearance-transition";
import { RewardBurst } from "@/components/reward-burst";
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
    if (Platform.OS === "web") {
      document.title = "Logic Coin";
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      document.documentElement.lang = language;
    }
  }, [language]);

  useEffect(() => {
    if (
      Platform.OS === "web" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      void navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    }
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
        <RewardBurst />
        <WebAnalytics />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
