import { Platform } from "react-native";

/**
 * AdMob identifiers are public: they ship inside every APK/IPA and can be read
 * straight out of the binary. They therefore live in source rather than in
 * `.env` — release and CI builds never see the untracked local `.env`, so an
 * env-only setup resolves to `undefined` there and no ad is ever requested.
 *
 * `EXPO_PUBLIC_ADMOB_*` still wins when set, which keeps per-environment
 * overrides possible without another build of the app.
 */
const UNITS = {
  android: {
    banner: "ca-app-pub-8830993776186608/2821994016",
    interstitial: "ca-app-pub-8830993776186608/2489504876",
  },
  ios: {
    banner: "ca-app-pub-8830993776186608/2821994016",
    interstitial: "ca-app-pub-8830993776186608/2489504876",
  },
} as const;

/**
 * Expo inlines `process.env.EXPO_PUBLIC_*` at bundle time, so every variable
 * has to be referenced statically — a computed key resolves to undefined.
 */
const OVERRIDES = {
  banner: {
    ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_IOS,
    android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID,
  },
  interstitial: {
    ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_IOS,
    android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_ANDROID,
  },
} as const;

export type AdmobUnit = "banner" | "interstitial";

export function admobUnitId(unit: AdmobUnit): string {
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const override = OVERRIDES[unit][platform];
  if (typeof override === "string" && override.trim().length > 0) {
    return override.trim();
  }
  return UNITS[platform][unit];
}
