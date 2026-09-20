import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { createFirstVisitTracker, FIRST_VISIT_KEY, parseFirstVisit } from "./first-visit";
import { createRegistrationReferralTracker } from "./registration-referral";
import { useAppStore } from "@/store/app-store";

const web = Platform.OS === "web" && typeof window !== "undefined";
const cookieFor = (key: string) => key === FIRST_VISIT_KEY ? "lc_first_visit" : "lc_registration_referral";
const storage = {
  async getItem(key: string) {
    const cookieName = cookieFor(key);
    if (web) {
      // Share attribution between the bare domain and www, including OAuth returns.
      const cookie = document.cookie.split("; ").find(value => value.startsWith(`${cookieName}=`));
      if (cookie) {
        try { const raw = decodeURIComponent(cookie.slice(cookieName.length + 1)); if (key !== FIRST_VISIT_KEY || parseFirstVisit(raw)) return raw; } catch { /* Fall back to local storage. */ }
      }
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    const cookieName = cookieFor(key);
    if (web) {
      const domain = /^(www\.)?logic-coin\.online$/.test(location.hostname) ? "; Domain=logic-coin.online" : "";
      document.cookie = `${cookieName}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${location.protocol === "https:" ? "; Secure" : ""}`;
    }
    return AsyncStorage.setItem(key, value);
  },
};
const track = createFirstVisitTracker(storage);
// Capture before redirects, store hydration, or an OAuth round trip can lose the URL.
const pendingReferral = createRegistrationReferralTracker(storage);
const initialUrl = web ? Promise.resolve(window.location.href) : Platform.OS !== "web"
  ? Linking.getInitialURL().catch(() => null) : Promise.resolve(null);
const ready = initialUrl.then(async (url) => {
  const visit = await track(url ?? "/");
  await pendingReferral.initialize(visit.referralCode);
  if (useAppStore.getState().authMode === "authenticated") await pendingReferral.clear();
  else if (url) await pendingReferral.capture(url);
});

export async function captureRegistrationReferral(url: string) {
  await ready;
  if (useAppStore.getState().authMode !== "authenticated") await pendingReferral.capture(url);
}

// getInitialURL only covers cold starts. Warm-start App Links arrive here.
if (Platform.OS !== "web") {
  Linking.addEventListener("url", ({ url }) => { void captureRegistrationReferral(url); });
}
useAppStore.subscribe((state, previous) => {
  if (state.authMode === "authenticated" && previous.authMode !== "authenticated") {
    void ready.then(() => pendingReferral.clear());
  }
});

export async function registrationReferralCode() {
  await ready;
  return pendingReferral.get();
}

export { FIRST_VISIT_KEY };
