import { Alert } from "@/components/localized-native";
import { isExpoGo } from "@/lib/native-runtime";
import type { GoogleSignin as GoogleSigninType } from "@react-native-google-signin/google-signin";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { AppText } from "@/components/app-text";
import { GoogleBrandIcon } from "@/components/google-brand-icon";
import { useTranslation } from "@/hooks/use-translation";
import { authEntryCopy } from "@/constants/auth-entry-copy";
import { selectGoogleAccount } from "@/lib/google-account-selection";
import { resumeGoogleAccount } from "@/lib/google-account-resume";
const GoogleSignin: typeof GoogleSigninType | null = isExpoGo ? null : require("@react-native-google-signin/google-signin").GoogleSignin;

export function GoogleSignInButton({ onCredential, disabled, autoPrompt = false }: {
  onCredential: (credential: string) => void; disabled?: boolean; autoPrompt?: boolean;
}) {
  const { language } = useTranslation();
  const c = authEntryCopy[language];
  const [busy, setBusy] = useState(false);
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const callback = useRef(onCredential);
  const attempted = useRef(false);
  const inFlight = useRef(false);
  useEffect(() => { callback.current = onCredential; }, [onCredential]);
  useEffect(() => {
    if (!clientId || !GoogleSignin) return;
    GoogleSignin.configure({ webClientId: clientId, offlineAccess: false });
  }, [clientId]);
  useEffect(() => {
    if (!autoPrompt || disabled || attempted.current || !clientId || !GoogleSignin) return;
    attempted.current = true;
    let active = true;
    inFlight.current = true; setBusy(true);
    void resumeGoogleAccount(GoogleSignin).then(result => {
      if (active && result.type === "success" && result.data.idToken) callback.current(result.data.idToken);
    }).catch(() => { /* Dismissal or unavailable Play Services keeps manual sign-in available. */ })
      .finally(() => { inFlight.current = false; if (active) setBusy(false); });
    return () => { active = false; setBusy(false); };
  }, [autoPrompt, clientId, disabled]);
  const signIn = async () => {
    if (!GoogleSignin) { Alert.alert("Google", c.googleInstalledOnly); return; }
    if (!clientId || inFlight.current || disabled) return;
    inFlight.current = true; setBusy(true);
    try {
      const result = await selectGoogleAccount(GoogleSignin);
      if (result.type === "success" && result.data.idToken) callback.current(result.data.idToken);
    } catch (error) { Alert.alert("Google", error instanceof Error ? error.message : c.googleUnavailable); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={c.google} onPress={() => void signIn()}
    disabled={disabled || busy || !clientId} style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }, (disabled || busy || !clientId) && { opacity: 0.6 }]}>
    <GoogleBrandIcon /><AppText style={styles.label}>{c.google}</AppText>{busy ? <ActivityIndicator size="small" color="#1F1F1F" /> : null}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 54, borderRadius: 28, paddingHorizontal: 16, borderWidth: 1, borderColor: "#747775", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 12 },
  label: { flex: 1, textAlign: "center", color: "#1F1F1F", fontSize: 14, fontWeight: "500" },
});
