import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { LogicCoinLogo } from "@/components/logo";
import { useAppTheme } from "@/hooks/use-app-theme";

const ANDROID_PACKAGE = "com.kinddevs.logiccoin";

export default function TelegramLoginScreen() {
  const params = useLocalSearchParams<{ telegram_token?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const token = Array.isArray(params.telegram_token)
    ? params.telegram_token[0]
    : params.telegram_token;
  const opening = Boolean(token);

  const continueInBrowser = useCallback(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    router.replace({ pathname: "/login", params: { telegram_token: token } });
  }, [router, token]);

  const openApplication = useCallback(() => {
    if (!token || Platform.OS !== "web") {
      continueInBrowser();
      return;
    }

    const encodedToken = encodeURIComponent(token);
    const appUrl = `logiccoin://login?telegram_token=${encodedToken}`;
    const fallbackUrl = new URL("/login", window.location.origin);
    fallbackUrl.searchParams.set("telegram_token", token);
    const isAndroid = /Android/i.test(window.navigator.userAgent);
    const destination = isAndroid
      ? `intent://login?telegram_token=${encodedToken}#Intent;scheme=logiccoin;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallbackUrl.toString())};end`
      : appUrl;

    let timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        window.location.replace(fallbackUrl.toString());
      }
    }, 1_600);
    const cancelFallback = () => {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(timer);
        timer = 0;
      }
    };
    document.addEventListener("visibilitychange", cancelFallback, { once: true });
    window.location.assign(destination);
  }, [continueInBrowser, token]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      continueInBrowser();
      return;
    }
    if (!token) {
      return;
    }
    const timer = window.setTimeout(openApplication, 180);
    return () => window.clearTimeout(timer);
  }, [continueInBrowser, openApplication, token]);

  return (
    <AppFrame scroll={false} contentStyle={styles.frame}>
      <GlassSurface intensity={72} variant="strong" style={styles.card}>
        <LogicCoinLogo compact />
        <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name="paper-plane" size={30} color={String(theme.primary)} />
        </View>
        <AppText variant="heading" style={styles.center}>
          {opening ? "Открываем Logic Coin" : "Telegram"}
        </AppText>
        <Pressable
          accessibilityRole="button"
          onPress={openApplication}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.78 : 1 },
          ]}
        >
          <AppText variant="label" color="#FFFFFF">Открыть приложение</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={continueInBrowser} hitSlop={8}>
          <AppText variant="caption" muted style={styles.center}>
            Продолжить в браузере
          </AppText>
        </Pressable>
      </GlassSurface>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 32,
    padding: 24,
    alignItems: "center",
    gap: 18,
  },
  icon: {
    width: 66,
    height: 66,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  primaryButton: {
    width: "100%",
    minHeight: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
});
