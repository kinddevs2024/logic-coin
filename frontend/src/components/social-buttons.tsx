import { useUiCopy } from "@/components/localized-native";
import { useAuthError } from "@/components/auth-error-dialog";
import Ionicons from "@/components/auth-icon";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";


import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { TelegramBrandIcon } from "@/components/telegram-brand-icon";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { authApi, type SocialAuthResult } from "@/lib/api";
import { useSignInCompletion } from "@/hooks/use-sign-in-completion";
import { authEntryCopy } from "@/constants/auth-entry-copy";

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
  const { copyText, copyContent } = useUiCopy();
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copyText(label)}
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
        <AppText variant="label" style={styles.label}>{copyContent(label)}</AppText>
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
  autoPrompt = false,
}: {
  onAuthenticated?: (result: SocialAuthResult) => void;
  autoPrompt?: boolean;
}) {
  const showError = useAuthError();
  const { language } = useTranslation();
  const [busy, setBusy] = useState<"google" | "telegram" | null>(null);
  const googleInFlightRef = useRef(false);
  const [telegramFlow, setTelegramFlow] = useState<{
    flowId: string;
    pollToken: string;
  } | null>(null);
  const completeAuth = useSignInCompletion(onAuthenticated);

  useEffect(() => {
    if (!telegramFlow) return;
    let active = true;
    let inFlight = false;
    const poll = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      try {
        const result = await authApi.telegramStatus(telegramFlow);
        if (result.status !== "pending") {
          active = false;
          setTelegramFlow(null);
          setBusy(null);
          completeAuth(result);
        }
      } catch (error) {
        active = false;
        setTelegramFlow(null);
        setBusy(null);
        showError(error);
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
  }, [completeAuth, telegramFlow, showError]);

  const google = async (credential: string) => {
    if (googleInFlightRef.current) return;
    googleInFlightRef.current = true;
    setBusy("google");
    try {
      completeAuth(await authApi.google(credential));
    } catch (error) {
      showError(error, () => void google(credential));
    } finally {
      setBusy(null);
      googleInFlightRef.current = false;
    }
  };

  const telegram = async () => {
    setBusy("telegram");
    try {
      const flow = await authApi.telegramStart();
      setTelegramFlow({ flowId: flow.flowId, pollToken: flow.pollToken });
      if (Platform.OS === "web") window.location.assign(flow.botUrl);
      else await Linking.openURL(flow.botUrl);
    } catch (error) {
      setBusy(null);
      showError(error, () => void telegram());
    }
  };

  return (
    <View style={styles.list}>
      <GoogleSignInButton
        autoPrompt={autoPrompt}
        onCredential={(credential: string) => void google(credential)}
        disabled={busy !== null}
      />
      <ProviderButton
        label={authEntryCopy[language].telegram}
        icon={<TelegramBrandIcon />}
        onPress={() => void telegram()}
        busy={busy === "telegram"}
        disabled={busy !== null && busy !== "telegram"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  error: { textAlign: "center", paddingHorizontal: 8 },
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
