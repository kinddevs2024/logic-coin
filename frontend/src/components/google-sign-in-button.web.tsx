import { useUiCopy } from "@/components/localized-native";

import { useEffect, useRef, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/app-text";
import { useTranslation } from "@/hooks/use-translation";
import { GoogleBrandIcon } from "./google-brand-icon";
import { authEntryCopy } from "@/constants/auth-entry-copy";

type GoogleCredentialResponse = { credential?: string };
type GoogleIdentity = {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select: boolean;
    use_fedcm_for_prompt?: boolean;
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
  autoPrompt = false,
}: {
  onCredential: (credential: string) => void;
  disabled?: boolean;
  autoPrompt?: boolean;
}) {
  const { copyText, copyContent } = useUiCopy();
  const hostRef = useRef<View>(null);
  const { language } = useTranslation();
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ?? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
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
        use_fedcm_for_prompt: true,
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
      if (autoPrompt && !promptedRef.current && !disabledRef.current) {
        promptedRef.current = true;
        identity.prompt();
      }
    };
    let script = document.querySelector<HTMLScriptElement>(
      `script[data-logic-google="${language}"]`,
    );
    const fail = () => {
      if (cancelled) return;
      script?.remove();
      setFailed(true);
    };
    const loaded = () => {
      window.clearTimeout(timeout);
      if (!(window as GoogleWindow).google?.accounts?.id) return fail();
      try { render(); } catch { fail(); }
    };
    // A blocked or interrupted SDK request must leave a usable retry button.
    const timeout = window.setTimeout(fail, 15_000);
    if ((window as GoogleWindow).google?.accounts?.id) loaded();
    else {
      const created = !script;
      script ??= document.createElement("script");
      script.addEventListener("load", loaded, { once: true });
      script.addEventListener("error", fail, { once: true });
      if (created) {
        script.src = `https://accounts.google.com/gsi/client?hl=${encodeURIComponent(language)}`;
        script.async = true;
        script.defer = true;
        script.dataset.logicGoogle = language;
        document.head.appendChild(script);
      }
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      script?.removeEventListener("load", loaded);
      script?.removeEventListener("error", fail);
      (window as GoogleWindow).google?.accounts?.id?.cancel();
      if (credentialTimerRef.current !== null) {
        window.clearTimeout(credentialTimerRef.current);
        credentialTimerRef.current = null;
      }
    };
  }, [autoPrompt, clientId, language, retry]);

  return (
    <View pointerEvents={disabled ? "none" : "auto"} style={[styles.shell, disabled && styles.disabled]}>
      {failed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copyText(authEntryCopy[language].google)}
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
            <GoogleBrandIcon />
          </View>
          <AppText variant="label" style={styles.fallbackLabel}>
            {copyContent(authEntryCopy[language].google)}
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
