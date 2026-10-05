import { isExpoGo } from "./native-runtime";
import type { RewardedAdProvider } from "./rewarded-ad";
// Expo Go has no advertising SDKs. Never simulate a paid view.
const unavailable: RewardedAdProvider = {
  initialize: async () => false,
  show: async placement => ({ provider: "demo", placement, completed: false, proof: "", reason: "unavailable" }),
  showInterstitial: async () => false,
  showAppOpen: async () => false,
  diagnostics: () => ({ configured: false, initialized: false, testMode: true, rewardedLoaded: false, interstitialLoaded: false, sdkVersion: null }),
};
export const rewardedAds: RewardedAdProvider = isExpoGo
  ? unavailable
  : require("./rewarded-ad-provider.sdk").rewardedAds;
