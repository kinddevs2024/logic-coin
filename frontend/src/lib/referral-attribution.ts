import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { createFirstVisitTracker, FIRST_VISIT_KEY, parseFirstVisit } from "./first-visit";

const web = Platform.OS === "web" && typeof window !== "undefined";
const cookieName = "lc_first_visit";
const storage = {
  async getItem(key: string) {
    if (web) {
      // Share attribution between the bare domain and www, including OAuth returns.
      const cookie = document.cookie.split("; ").find(value => value.startsWith(`${cookieName}=`));
      if (cookie) {
        try { const raw = decodeURIComponent(cookie.slice(cookieName.length + 1)); if (parseFirstVisit(raw)) return raw; } catch { /* Fall back to local storage. */ }
      }
    }
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (web) {
      const domain = /^(www\.)?logic-coin\.online$/.test(location.hostname) ? "; Domain=logic-coin.online" : "";
      document.cookie = `${cookieName}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${location.protocol === "https:" ? "; Secure" : ""}`;
    }
    return AsyncStorage.setItem(key, value);
  },
};
const track = createFirstVisitTracker(storage);
// Capture before redirects, store hydration, or an OAuth round trip can lose the URL.
const firstVisit = web ? track(window.location.href) : Platform.OS !== "web"
  ? Linking.getInitialURL().then(url => track(url ?? "/")) : undefined;

export async function registrationReferralCode() {
  const visit = await firstVisit;
  return visit?.referralCode ?? undefined;
}

export { FIRST_VISIT_KEY };
