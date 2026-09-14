import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/app-text";
import { useTranslation } from "@/hooks/use-translation";
import { loadGoogleIdentity } from "@/lib/google-identity.web";

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
  const callback = useRef(onCredential);
  useEffect(() => { callback.current = onCredential; }, [onCredential]);

  useEffect(() => {
    if (!clientId) return;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;
    let cancelled = false;
    void loadGoogleIdentity().then((identity) => {
      if (cancelled) return;
      identity.initialize({
        client_id: clientId,
        callback: (response) => response.credential && callback.current(response.credential),
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
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
    };
  }, [clientId, language, retry]);

  return (
    <View pointerEvents={disabled ? "none" : "auto"} style={[styles.shell, disabled && styles.disabled]}>
      {failed ? (
        <Pressable accessibilityRole="button" disabled={!clientId} onPress={() => { setFailed(false); setRetry((value) => value + 1); }} style={styles.fallback}>
          <View style={styles.fallbackIcon}>
            <Ionicons name="logo-google" color="#4285F4" size={20} />
          </View>
          <AppText variant="label" style={styles.fallbackLabel}>{clientId ? (language === "ru" ? "Google · Повторить" : "Google · Retry") : (language === "ru" ? "Google временно недоступен" : "Google unavailable")}</AppText>
          <Ionicons name="refresh" color="#69737D" size={18} />
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
