export type RewardedAdPlacement =
  | "challenge-first-game"
  | "challenge-first-replay"
  | "challenge-third-game"
  | "challenge-day-complete"
  | "navigation-frequency"
  | "practice-replay";

export type InterstitialAdPlacement =
  | "challenge-checkpoint"
  | "navigation-frequency";

export type RewardedAdReceipt = {
  provider: "yandex" | "appodeal" | "demo";
  placement: RewardedAdPlacement;
  completed: boolean;
  proof: string;
  amount?: number;
  currency?: string;
  reason?: "unavailable" | "dismissed" | "failed" | "timeout";
};

export type AdsDiagnostics = {
  configured: boolean;
  initialized: boolean;
  testMode: boolean;
  rewardedLoaded: boolean;
  interstitialLoaded: boolean;
  sdkVersion: string | null;
};

export interface RewardedAdProvider {
  initialize(userId?: string): Promise<boolean>;
  show(placement: RewardedAdPlacement): Promise<RewardedAdReceipt>;
  showInterstitial(placement: InterstitialAdPlacement): Promise<boolean>;
  diagnostics(): AdsDiagnostics;
}

export { rewardedAds } from "./rewarded-ad-provider";
