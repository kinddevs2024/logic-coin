import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { authApi, type AuthResult } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

function ProviderButton({
  label,
  icon,
  onPress,
  busy,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pressable,
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <GlassSurface intensity={48} variant="soft" style={styles.button}>
        <View style={styles.providerIcon}>{icon}</View>
        <AppText variant="label" style={styles.label}>{label}</AppText>
        {busy ? (
          <ActivityIndicator size="small" color={String(theme.textMuted)} />
        ) : (
          <Ionicons name="arrow-forward" size={18} color={String(theme.textMuted)} />
        )}
      </GlassSurface>
    </Pressable>
  );
}

export function SocialButtons({
  onAuthenticated,
}: {
  onAuthenticated?: (result: AuthResult) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const authenticate = useAppStore((state) => state.authenticate);
  const [busy, setBusy] = useState<"google" | "yandex" | "telegram" | null>(null);
  const [telegramFlow, setTelegramFlow] = useState<{
    flowId: string;
    pollToken: string;
  } | null>(null);
  const completeAuth = useCallback((result: AuthResult) => {
    if (onAuthenticated) return onAuthenticated(result);
    authenticate({
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      balanceUnits: result.user.wallet?.availableUnits,
    });
    router.replace("/(tabs)");
  }, [authenticate, onAuthenticated, router]);

  useEffect(() => {
    if (!telegramFlow) return;
    let active = true;
    let inFlight = false;
    const poll = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const result = await authApi.telegramStatus(telegramFlow);
        if (result.status === "complete") {
          active = false;
          setTelegramFlow(null);
          setBusy(null);
          completeAuth(result);
        }
      } catch (error) {
        active = false;
        setTelegramFlow(null);
        setBusy(null);
        Alert.alert("Telegram", error instanceof Error ? error.message : t("auth.invalid"));
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 2_500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [completeAuth, telegramFlow, t]);

  const google = async (credential: string) => {
    setBusy("google");
    try {
      completeAuth(await authApi.google(credential));
    } catch (error) {
      Alert.alert("Google", error instanceof Error ? error.message : t("auth.invalid"));
    } finally {
      setBusy(null);
    }
  };

  const yandex = async () => {
    setBusy("yandex");
    try {
      const redirectUri = Platform.OS === "web"
        ? `${window.location.origin}/oauth/yandex`
        : Linking.createURL("/oauth/yandex");
      const { authorizationUrl } = await authApi.yandexStart(redirectUri);
      if (Platform.OS === "web") {
        window.location.assign(authorizationUrl);
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirectUri);
      if (result.type !== "success") return;
      const callback = new URL(result.url);
      const code = callback.searchParams.get("code");
      const state = callback.searchParams.get("state");
      if (!code || !state) throw new Error(t("auth.invalid"));
      completeAuth(await authApi.yandexExchange({ code, state }));
    } catch (error) {
      Alert.alert(t("auth.yandex"), error instanceof Error ? error.message : t("auth.invalid"));
    } finally {
      setBusy(null);
    }
  };

  const telegram = async () => {
    setBusy("telegram");
    const popup = Platform.OS === "web" ? window.open("about:blank", "logic-coin-telegram") : null;
    try {
      const flow = await authApi.telegramStart();
      setTelegramFlow({ flowId: flow.flowId, pollToken: flow.pollToken });
      if (popup) popup.location.href = flow.botUrl;
      else await Linking.openURL(flow.botUrl);
    } catch (error) {
      popup?.close();
      setBusy(null);
      Alert.alert("Telegram", error instanceof Error ? error.message : t("auth.invalid"));
    }
  };

  return (
    <View style={styles.list}>
      <GoogleSignInButton
        onCredential={(credential: string) => void google(credential)}
        disabled={busy !== null}
      />
      <ProviderButton
        label={t("auth.yandex")}
        busy={busy === "yandex"}
        disabled={busy !== null}
        onPress={() => void yandex()}
        icon={
          <View style={[styles.brandDot, { backgroundColor: "#FC3F1D" }]}>
            <AppText variant="label" color="#FFFFFF">Я</AppText>
          </View>
        }
      />
      <ProviderButton
        label="Telegram"
        busy={busy === "telegram"}
        disabled={busy !== null}
        onPress={() => void telegram()}
        icon={
          <View style={[styles.brandDot, { backgroundColor: "#229ED9" }]}>
            <Ionicons name="paper-plane" color="#FFFFFF" size={17} />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  pressable: { minHeight: 54, borderRadius: 999 },
  button: {
    minHeight: 54,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  providerIcon: { width: 34, alignItems: "center" },
  brandDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1 },
  disabled: { opacity: 0.58 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
