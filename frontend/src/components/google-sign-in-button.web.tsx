import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/app-text";
import { useTranslation } from "@/hooks/use-translation";

type GoogleCredentialResponse = { credential?: string };
type GoogleIdentity = {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(element: HTMLElement, options: Record<string, string | number>): void;
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
        callback: (response) => response.credential && onCredential(response.credential),
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
      script.addEventListener("error", () => setFailed(true), { once: true });
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      existing?.removeEventListener("load", render);
    };
  }, [clientId, language, onCredential]);

  return (
    <View pointerEvents={disabled ? "none" : "auto"} style={[styles.shell, disabled && styles.disabled]}>
      {failed ? (
        <View style={styles.fallback}>
          <View style={styles.fallbackIcon}>
            <Ionicons name="logo-google" color="#4285F4" size={20} />
          </View>
          <AppText variant="label" style={styles.fallbackLabel}>Google</AppText>
          <Ionicons name="arrow-forward" color="#69737D" size={18} />
        </View>
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
