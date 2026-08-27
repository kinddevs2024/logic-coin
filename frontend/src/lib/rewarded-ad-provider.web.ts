import type {
  AdsDiagnostics,
  InterstitialAdPlacement,
  RewardedAdPlacement,
  RewardedAdProvider,
  RewardedAdReceipt,
} from "./rewarded-ad";

class WebRewardedAdProvider implements RewardedAdProvider {
  async initialize() {
    return false;
  }

  async show(placement: RewardedAdPlacement): Promise<RewardedAdReceipt> {
    return {
      provider: "demo",
      placement,
      completed: false,
      proof: "",
      reason: "unavailable",
    };
  }

  async showInterstitial(_placement: InterstitialAdPlacement) {
    return false;
  }

  diagnostics(): AdsDiagnostics {
    return {
      configured: false,
      initialized: false,
      testMode: false,
      rewardedLoaded: false,
      interstitialLoaded: false,
      sdkVersion: null,
    };
  }
}

export const rewardedAds: RewardedAdProvider = new WebRewardedAdProvider();
