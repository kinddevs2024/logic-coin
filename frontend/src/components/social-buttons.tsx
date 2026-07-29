import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { AppText } from "@/components/app-text";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { authApi, type AuthResult } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type GoogleCredentialResponse = { credential?: string };
type GoogleIdentity = {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(
    element: HTMLElement,
    options: Record<string, string | number>,
  ): void;
};

type GoogleWindow = Window & {
  google?: { accounts?: { id?: GoogleIdentity } };
};

function GoogleWebButton({
  onCredential,
}: {
  onCredential: (credential: string) => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const hostRef = useRef<View>(null);
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const [failed, setFailed] = useState(!clientId);

  useEffect(() => {
    if (Platform.OS !== "web" || !clientId) return;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;

    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      const identity = (window as GoogleWindow).google?.accounts?.id;
      if (!identity) {
        setFailed(true);
        return;
      }
      identity.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) onCredential(response.credential);
        },
      });
      host.replaceChildren();
      identity.renderButton(host, {
        type: "standard",
        theme: theme.mode === "dark" ? "filled_black" : "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: Math.max(160, Math.min(260, host.clientWidth || 220)),
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-logic-google="true"]',
    );
    if ((window as GoogleWindow).google?.accounts?.id) {
      render();
    } else if (existing) {
      existing.addEventListener("load", render, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.logicGoogle = "true";
      script.addEventListener("load", render, { once: true });
      script.addEventListener("error", () => setFailed(true), { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      existing?.removeEventListener("load", render);
    };
  }, [clientId, onCredential, theme.mode]);

  if (failed) {
    return (
      <View style={styles.webProviderFallback}>
        <AppText variant="caption" muted>
          {t("auth.google")}
        </AppText>
      </View>
    );
  }

  return <View ref={hostRef} style={styles.googleHost} />;
}

export function SocialButtons() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const authenticate = useAppStore((state) => state.authenticate);
  const [busy, setBusy] = useState<"google" | "yandex" | null>(null);

  const completeAuth = (result: AuthResult) => {
    authenticate({
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      balanceUnits: result.user.wallet?.availableUnits,
    });
    router.replace("/(tabs)");
  };

  const google = async (credential: string) => {
    setBusy("google");
    try {
      completeAuth(await authApi.google(credential));
    } catch (error) {
      Alert.alert(
        t("auth.google"),
        error instanceof Error ? error.message : t("auth.invalid"),
      );
    } finally {
      setBusy(null);
    }
  };

  const yandex = async () => {
    setBusy("yandex");
    try {
      const redirectUri =
        Platform.OS === "web"
          ? `${window.location.origin}/oauth/yandex`
          : Linking.createURL("/oauth/yandex");
      const { authorizationUrl } = await authApi.yandexStart(redirectUri);
      if (Platform.OS === "web") {
        window.location.assign(authorizationUrl);
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(
        authorizationUrl,
        redirectUri,
      );
      if (result.type !== "success") return;
      const callback = new URL(result.url);
      const code = callback.searchParams.get("code");
      const state = callback.searchParams.get("state");
      if (!code || !state) throw new Error(t("auth.invalid"));
      completeAuth(await authApi.yandexExchange({ code, state }));
    } catch (error) {
      Alert.alert(
        t("auth.yandex"),
        error instanceof Error ? error.message : t("auth.invalid"),
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.row}>
      {Platform.OS === "web" ? (
        <View
          style={[
            styles.googleShell,
            {
              backgroundColor: theme.glassFillStrong,
              borderColor: theme.glassBorder,
            },
          ]}
        >
          <GoogleWebButton onCredential={(value) => void google(value)} />
        </View>
      ) : (
        <Pressable
          onPress={() => Alert.alert(t("auth.google"), t("auth.socialReady"))}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: theme.glassFillStrong,
              borderColor: theme.glassBorder,
              opacity: pressed ? 0.72 : busy ? 0.55 : 1,
            },
          ]}
        >
          <View style={[styles.provider, { backgroundColor: "#FFFFFF" }]}>
            <AppText variant="label" color="#4285F4">
              G
            </AppText>
          </View>
          <AppText variant="label">{t("auth.google")}</AppText>
        </Pressable>
      )}
      <Pressable
        onPress={() => void yandex()}
        disabled={busy !== null}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.glassFillStrong,
            borderColor: theme.glassBorder,
            opacity: pressed ? 0.72 : busy ? 0.55 : 1,
          },
        ]}
      >
        <View style={[styles.provider, { backgroundColor: "#FC3F1D" }]}>
          <AppText variant="label" color="#FFFFFF">
            Я
          </AppText>
        </View>
        <AppText variant="label">{t("auth.yandex")}</AppText>
        <Ionicons
          name={busy === "yandex" ? "hourglass-outline" : "open-outline"}
          color={String(theme.textMuted)}
          size={15}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  provider: {
    width: 25,
    height: 25,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  googleShell: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  googleHost: {
    width: "100%",
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  webProviderFallback: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
});
