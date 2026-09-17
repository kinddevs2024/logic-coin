import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";

import { AppButton } from "@/components/buttons";
import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { LogoMark } from "@/components/logo";
import { useAppTheme } from "@/hooks/use-app-theme";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.kinddevs.logiccoin";

export default function ReferralLandingScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const code = rawCode?.trim().toUpperCase() ?? "";
  const validCode = /^[A-Z0-9-]{4,32}$/.test(code);

  useEffect(() => {
    if (!validCode) return;
    if (Platform.OS !== "web") {
      router.replace({ pathname: "/login", params: { ref: code } });
      return;
    }
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (!isAndroid) return;
    // Chrome opens the installed package. If it is absent, the browser uses
    // the explicit Play fallback instead of leaving the visitor on a dead URL.
    const intent = `intent://invite/${encodeURIComponent(code)}#Intent;scheme=logiccoin;package=com.kinddevs.logiccoin;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
    window.location.replace(intent);
  }, [code, router, validCode]);

  if (!validCode) {
    return <AppFrame><AppText color={String(theme.danger)}>Некорректная реферальная ссылка.</AppText></AppFrame>;
  }

  return (
    <AppFrame>
      <View style={styles.center}>
        <GlassSurface variant="strong" intensity={82} style={styles.card}>
          <LogoMark size={78} />
          <AppText variant="title" style={styles.title}>Вас пригласили в Logic Coin</AppText>
          <AppText muted style={styles.copy}>Играйте в ежедневных челленджах и получайте призы вместе с другом.</AppText>
          {Platform.OS === "web" ? (
            <AppButton icon="download-outline" onPress={() => void Linking.openURL(PLAY_STORE_URL)}>Открыть в Google Play</AppButton>
          ) : null}
          <AppButton variant="secondary" icon="arrow-forward" onPress={() => router.replace({ pathname: "/login", params: { ref: code } })}>Продолжить на сайте</AppButton>
          <Ionicons name="gift-outline" size={25} color={String(theme.primary)} />
        </GlassSurface>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center" },
  card: { borderRadius: 28, padding: 24, alignItems: "center", gap: 14 },
  title: { textAlign: "center" },
  copy: { textAlign: "center", lineHeight: 21 },
});
