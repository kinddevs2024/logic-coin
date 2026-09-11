import { Platform } from "react-native";

/**
 * AdMob identifiers are public: they ship inside every APK/IPA and can be read
 * straight out of the binary. They therefore live in source rather than in
 * `.env` — release and CI builds never see the untracked local `.env`, so an
 * env-only setup resolves to `undefined` there and no ad is ever requested.
 *
 * `EXPO_PUBLIC_ADMOB_*` still wins when set, which keeps per-environment
 * overrides possible.
 */
const LIVE_UNITS = {
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
 * Google's public demo units. Emulators and simulators are flagged as test
 * devices by the SDK itself and are *never* served live inventory — a live
 * request from one only ever answers `Ad failed to load : 0`. Requesting live
 * units from a developer build is also invalid traffic under AdMob policy and
 * risks the account, so development deliberately uses these instead.
 */
const TEST_UNITS = {
  android: {
    banner: "ca-app-pub-3940256099942544/6300978111",
    interstitial: "ca-app-pub-3940256099942544/1033173712",
  },
  ios: {
    banner: "ca-app-pub-3940256099942544/2934735716",
    interstitial: "ca-app-pub-3940256099942544/4411468910",
  },
} as const;

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

/** Escape hatch: request live units from a development build anyway. */
const FORCE_LIVE =
  process.env.EXPO_PUBLIC_ADMOB_FORCE_LIVE?.toLowerCase() === "true";

export type AdmobUnit = "banner" | "interstitial";

export function admobUsesLiveUnits() {
  return !__DEV__ || FORCE_LIVE;
}

export function admobUnitId(unit: AdmobUnit): string {
  const platform = Platform.OS === "ios" ? "ios" : "android";
  if (!admobUsesLiveUnits()) return TEST_UNITS[platform][unit];

  const override = OVERRIDES[unit][platform];
  if (typeof override === "string" && override.trim().length > 0) {
    return override.trim();
  }
  return LIVE_UNITS[platform][unit];
}

/** Used as a last-resort retry so a development build always shows something. */
export function admobTestUnitId(unit: AdmobUnit): string {
  return TEST_UNITS[Platform.OS === "ios" ? "ios" : "android"][unit];
}
