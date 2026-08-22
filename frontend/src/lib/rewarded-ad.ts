export type RewardedAdPlacement = "challenge-first-game" | "challenge-day-complete";

export type RewardedAdReceipt = {
  provider: "placeholder" | "applovin-max";
  placement: RewardedAdPlacement;
  completed: boolean;
  proof: string;
};

export interface RewardedAdProvider {
  show(placement: RewardedAdPlacement): Promise<RewardedAdReceipt>;
}

class PlaceholderRewardedAdProvider implements RewardedAdProvider {
  async show(placement: RewardedAdPlacement): Promise<RewardedAdReceipt> {
    await new Promise((resolve) => setTimeout(resolve, 720));
    return {
      provider: "placeholder",
      placement,
      completed: true,
      proof: `demo-${placement}-${Date.now()}`,
    };
  }
}

// Swap this singleton for an AppLovin MAX adapter when native ad credentials are ready.
export const rewardedAds: RewardedAdProvider = new PlaceholderRewardedAdProvider();
