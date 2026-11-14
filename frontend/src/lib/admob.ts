export type AdmobFailureReason =
  | "unsupported"
  | "not-configured"
  | "no-fill"
  | "timeout"
  | "already-showing"
  | "error";

export type AdmobInterstitialResult = {
  shown: boolean;
  reason?: AdmobFailureReason;
};

export interface AdmobController {
  /** Consent + SDK start. Safe to call repeatedly: the work happens once. */
  initialize(): Promise<boolean>;
  /** Warms an ad up so the next `showInterstitial` is instant. Never throws. */
  preloadInterstitial(): Promise<void>;
  /** Loads and presents an interstitial. Never throws and always settles. */
  showInterstitial(): Promise<AdmobInterstitialResult>;
  /** Ad unit for the banner slot, or null when banners are unavailable. */
  bannerUnitId(): string | null;
}

export { admob } from "./admob-provider";
