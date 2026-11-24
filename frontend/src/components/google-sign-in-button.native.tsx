import { useAuthError } from "@/components/auth-error-dialog";
import { checkAuthConnection } from "@/lib/auth-error";
import { API_URL } from "@/lib/api";
import { isExpoGo } from "@/lib/native-runtime";
import type { GoogleSignin as GoogleSigninType } from "@react-native-google-signin/google-signin";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet } from "react-native";
import { AppText } from "@/components/app-text";
import { GoogleBrandIcon } from "@/components/google-brand-icon";
import { useTranslation } from "@/hooks/use-translation";
import { authEntryCopy } from "@/constants/auth-entry-copy";
import { selectGoogleAccount } from "@/lib/google-account-selection";
import { resumeGoogleAccount } from "@/lib/google-account-resume";
import { googleSignInCategory, reportGoogleSignInError, withGoogleSignInCategory } from "@/lib/google-signin-diagnostic";
import { openGoogleBrowserSignIn } from "@/lib/google-browser-sign-in";
// The browser route uses the configured web OAuth client independently of APK signing.
const useBrowserSignIn = Platform.OS === "android" && !isExpoGo;
const GoogleSignin: typeof GoogleSigninType | null = isExpoGo || useBrowserSignIn ? null : require("@react-native-google-signin/google-signin").GoogleSignin;

export function GoogleSignInButton({ onCredential, disabled, autoPrompt = false }: {
  onCredential: (credential: string) => void; disabled?: boolean; autoPrompt?: boolean;
}) {
  const { language } = useTranslation();
  const showError = useAuthError();
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
    void checkAuthConnection(API_URL).then(() => active ? resumeGoogleAccount(GoogleSignin) : null).then(result => {
      if (active && result?.type === "success") {
        if (result.data.idToken) callback.current(result.data.idToken);
        else reportGoogleSignInError({ code: "MISSING_ID_TOKEN" });
      }
    }).catch((error) => { reportGoogleSignInError(error); /* Manual sign-in remains available. */ })
      .finally(() => { inFlight.current = false; if (active) setBusy(false); });
    return () => { active = false; setBusy(false); };
  }, [autoPrompt, clientId, disabled]);
  const signIn = async () => {
    if (inFlight.current || disabled) return;
    if (!useBrowserSignIn && !GoogleSignin) { showError(new Error(c.googleInstalledOnly)); return; }
    if (!useBrowserSignIn && !clientId) return;
    inFlight.current = true; setBusy(true);
    try {
      await checkAuthConnection(API_URL);
      if (useBrowserSignIn) {
        await openGoogleBrowserSignIn();
        return;
      }
      if (!GoogleSignin) return;
      const result = await selectGoogleAccount(GoogleSignin);
      if (result.type === "success") {
        if (result.data.idToken) callback.current(result.data.idToken);
        else throw Object.assign(new Error("Missing Google identity token"), { code: "MISSING_ID_TOKEN" });
      }
    } catch (error) {
      if (useBrowserSignIn) {
        showError(error, () => void signIn());
        return;
      }
      reportGoogleSignInError(error);
      const category = googleSignInCategory(error);
      if (category === "developer_error" || category === "play_services_unavailable") {
        try {
          await openGoogleBrowserSignIn();
          return;
        } catch (browserError) {
          showError(browserError, () => void signIn());
          return;
        }
      }
      if (category !== "cancelled") showError(withGoogleSignInCategory(error), () => void signIn());
    }
    finally { inFlight.current = false; setBusy(false); }
  };
  const unavailable = disabled || busy || (!clientId && !useBrowserSignIn);
  return <Pressable accessibilityRole="button" accessibilityLabel={c.google} onPress={() => void signIn()}
    disabled={unavailable} style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }, unavailable && { opacity: 0.6 }]}>
    <GoogleBrandIcon /><AppText style={styles.label}>{c.google}</AppText>{busy ? <ActivityIndicator size="small" color="#1F1F1F" /> : null}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 54, borderRadius: 28, paddingHorizontal: 16, borderWidth: 1, borderColor: "#747775", backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 12 },
  label: { flex: 1, textAlign: "center", color: "#1F1F1F", fontSize: 14, fontWeight: "500" },
});
