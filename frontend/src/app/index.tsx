import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

import { LogoMark } from "@/components/logo";
import { useAppTheme } from "@/hooks/use-app-theme";
import { authApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type TelegramWebAppWindow = Window & {
  Telegram?: {
    WebApp?: {
      initData?: string;
      ready?: () => void;
      expand?: () => void;
    };
  };
};

export default function IndexScreen() {
  const theme = useAppTheme();
  const hydrated = useAppStore((state) => state.hydrated);
  const language = useAppStore((state) => state.language);
  const onboardingDone = useAppStore((state) => state.onboardingDone);
  const authMode = useAppStore((state) => state.authMode);
  const authenticate = useAppStore((state) => state.authenticate);
  const [telegramAuthPending, setTelegramAuthPending] = useState(false);
  const telegramAuthStarted = useRef(false);

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      !hydrated ||
      authMode ||
      telegramAuthStarted.current
    ) {
      return;
    }

    const webApp = (window as TelegramWebAppWindow).Telegram?.WebApp;
    if (!webApp) return;

    telegramAuthStarted.current = true;
    webApp.ready?.();
    webApp.expand?.();

    let cancelled = false;
    let attempts = 0;
    const timer = window.setInterval(() => {
      const initData = webApp.initData?.trim();
      attempts += 1;
      if (!initData && attempts < 20) return;
      window.clearInterval(timer);
      if (!initData) return;

      setTelegramAuthPending(true);
      void authApi.telegramMiniApp(initData)
        .then((result) => {
          if (cancelled) return;
          authenticate({
            user: result.user,
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken,
            balanceUnits: result.user.wallet?.availableUnits,
          });
        })
        .catch(() => {
          // Fall back to the regular login screen if Telegram data is invalid.
          if (!cancelled) setTelegramAuthPending(false);
        });
    }, 100);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authMode, authenticate, hydrated]);

  if (!hydrated || telegramAuthPending) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          backgroundColor: theme.background,
        }}
      >
        <LogoMark size={78} />
        <ActivityIndicator color={String(theme.primary)} />
      </View>
    );
  }
  if (authMode) return <Redirect href="/(tabs)" />;
  if (!language) return <Redirect href="/language" />;
  if (!onboardingDone) return <Redirect href="/onboarding" />;
  if (!authMode) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)" />;
}
