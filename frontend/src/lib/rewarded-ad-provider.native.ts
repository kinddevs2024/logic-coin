import type {
  AdsDiagnostics,
  InterstitialAdPlacement,
  RewardedAdPlacement,
  RewardedAdProvider,
  RewardedAdReceipt,
} from "./rewarded-ad";
import { yandexRewardedAds } from "./yandex-rewarded.native";

class YandexRewardedAdProvider implements RewardedAdProvider {
  async initialize() {
    return yandexRewardedAds.initialize();
  }

  async show(placement: RewardedAdPlacement): Promise<RewardedAdReceipt> {
    return yandexRewardedAds.show(placement);
  }

  async showInterstitial(_placement: InterstitialAdPlacement) {
    return false;
  }

  diagnostics(): AdsDiagnostics {
    return {
      ...yandexRewardedAds.diagnostics(),
      interstitialLoaded: false,
    };
  }
}

export const rewardedAds: RewardedAdProvider = new YandexRewardedAdProvider();
