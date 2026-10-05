import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";

export default function TelegramLoginScreen() {
  const params = useLocalSearchParams<{ telegram_token?: string | string[]; target?: string }>();
  const token = Array.isArray(params.telegram_token) ? params.telegram_token[0] : params.telegram_token;
  const router = useRouter();
  const openApplication = useCallback(() => {
    if (Platform.OS !== "web") {
      router.replace(token ? { pathname: "/login", params: { telegram_token: token } } : "/login");
      return;
    }
    const bridge = new URL("/api/v1/auth/app/open", window.location.origin);
    if (token) bridge.hash = new URLSearchParams({ telegram_token: token }).toString();
    window.location.replace(bridge.toString());
  }, [router, token]);
  const continueInBrowser = useCallback(() => {
    router.replace(token ? { pathname: "/login", params: { telegram_token: token } } : "/login");
  }, [router, token]);
  useEffect(() => {
    // Covers old bot links too. Do not consume the APK token in a mobile webview.
    if (Platform.OS !== "web" || params.target === "app" || (params.target !== "web" && /Android/i.test(window.navigator.userAgent))) {
      openApplication();
    }
  }, [openApplication, params.target]);
  return <AppFrame contentStyle={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
    <GlassSurface variant="strong" style={{ maxWidth: 440, width: "100%", padding: 24, borderRadius: 24, gap: 18 }}>
      <AppText variant="heading" style={{ textAlign: "center" }}>Вход в Logic Coin подтверждён</AppText>
      <AppText muted style={{ textAlign: "center" }}>Если вы начали вход в APK, вернитесь в приложение на телефоне.</AppText>
      <AppButton onPress={openApplication}>Открыть приложение</AppButton>
      {params.target !== "app" ? <AppButton variant="ghost" onPress={continueInBrowser}>Продолжить в браузере</AppButton> : null}
    </GlassSurface>
  </AppFrame>;
}
