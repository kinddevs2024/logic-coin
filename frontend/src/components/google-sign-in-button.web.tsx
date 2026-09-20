import { useEffect, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/app-text";
import { useTranslation } from "@/hooks/use-translation";

type GoogleCredentialResponse = { credential?: string };
type GoogleIdentity = {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select: boolean;
  }): void;
  renderButton(element: HTMLElement, options: Record<string, string | number>): void;
  prompt(): void;
  cancel(): void;
};
type GoogleWindow = Window & {
  google?: { accounts?: { id?: GoogleIdentity } };
};

export function GoogleSignInButton({
  onCredential,
  disabled,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
}) {
  const hostRef = useRef<View>(null);
  const { language } = useTranslation();
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const [failed, setFailed] = useState(!clientId);
  const [retry, setRetry] = useState(0);
  const callbackRef = useRef(onCredential);
  const disabledRef = useRef(disabled);
  const promptedRef = useRef(false);
  const credentialRef = useRef<string | null>(null);
  const credentialTimerRef = useRef<number | null>(null);

  useEffect(() => {
    callbackRef.current = onCredential;
    disabledRef.current = disabled;
  }, [onCredential, disabled]);

  useEffect(() => {
    if (!clientId) return;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      const identity = (window as GoogleWindow).google?.accounts?.id;
      if (!identity) return setFailed(true);
      identity.initialize({
        client_id: clientId,
        callback: (response) => {
          if (
            !cancelled &&
            !disabledRef.current &&
            response.credential &&
            response.credential !== credentialRef.current
          ) {
            credentialRef.current = response.credential;
            callbackRef.current(response.credential);
            if (credentialTimerRef.current !== null) {
              window.clearTimeout(credentialTimerRef.current);
            }
            credentialTimerRef.current = window.setTimeout(() => {
              credentialRef.current = null;
              credentialTimerRef.current = null;
            }, 5000);
          }
        },
        auto_select: false,
      });
      host.replaceChildren();
      identity.renderButton(host, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        locale: language,
        width: Math.max(260, Math.min(374, host.clientWidth || 360)),
      });
      // Let Google/browser decide eligibility, dismissal cooldown and account UI.
      if (!promptedRef.current && !disabledRef.current) {
        promptedRef.current = true;
        identity.prompt();
      }
    };
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-logic-google="${language}"]`,
    );
    if ((window as GoogleWindow).google?.accounts?.id) render();
    else if (existing) existing.addEventListener("load", render, { once: true });
    else {
      const script = document.createElement("script");
      script.src = `https://accounts.google.com/gsi/client?hl=${encodeURIComponent(language)}`;
      script.async = true;
      script.defer = true;
      script.dataset.logicGoogle = language;
      script.addEventListener("load", render, { once: true });
      script.addEventListener("error", () => {
        script.remove();
        setFailed(true);
      }, { once: true });
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      existing?.removeEventListener("load", render);
      (window as GoogleWindow).google?.accounts?.id?.cancel();
      if (credentialTimerRef.current !== null) {
        window.clearTimeout(credentialTimerRef.current);
        credentialTimerRef.current = null;
      }
    };
  }, [clientId, language, retry]);

  return (
    <View pointerEvents={disabled ? "none" : "auto"} style={[styles.shell, disabled && styles.disabled]}>
      {failed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={language === "ru" ? "Войти через Google" : "Sign in with Google"}
          disabled={!clientId || disabled}
          onPress={() => {
            credentialRef.current = null;
            promptedRef.current = false;
            setFailed(false);
            setRetry((value) => value + 1);
          }}
          style={styles.fallback}
        >
          <View style={styles.fallbackIcon}>
            <Ionicons name="logo-google" color="#4285F4" size={20} />
          </View>
          <AppText variant="label" style={styles.fallbackLabel}>
            {language === "ru" ? "Войти через Google" : "Sign in with Google"}
          </AppText>
          <Ionicons name="arrow-forward" color="#69737D" size={18} />
        </Pressable>
      ) : (
        <View ref={hostRef} style={styles.host} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 54,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.58 },
  host: { width: "100%", minHeight: 54, alignItems: "center", justifyContent: "center" },
  fallback: {
    width: "100%",
    minHeight: 54,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fallbackIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackLabel: { flex: 1 },
});
