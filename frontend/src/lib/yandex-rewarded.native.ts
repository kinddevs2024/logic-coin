import { DeviceEventEmitter, NativeModules, Platform } from "react-native";

import type { AdsDiagnostics, RewardedAdPlacement, RewardedAdReceipt } from "./rewarded-ad";

const EVENT_NAME = "YandexAdsRewardedEvent";
const PRODUCTION_AD_UNIT_ID = "R-M-19993052-1";
const TEST_AD_UNIT_ID = "demo-rewarded-yandex";
const TEST_MODE =
  __DEV__ || process.env.EXPO_PUBLIC_YANDEX_TEST_MODE?.toLowerCase() === "true";
const AD_UNIT_ID = process.env.EXPO_PUBLIC_YANDEX_AD_UNIT_ID?.trim() || PRODUCTION_AD_UNIT_ID;
const LOAD_TIMEOUT_MS = 15_000;

type NativeRewardedResult = {
  completed: boolean;
  proof: string;
  amount?: number;
  currency?: string;
  reason?: RewardedAdReceipt["reason"];
  error?: string;
};

type NativeYandexAds = {
  initialize(adUnitId: string, enableLogging: boolean): Promise<boolean>;
  loadRewarded(): Promise<boolean>;
  isRewardedLoaded(): Promise<boolean>;
  showRewarded(): Promise<NativeRewardedResult>;
};

type YandexEvent = {
  type: "initialized" | "loading" | "loaded" | "shown" | "reward" | "closed" | "failed" | "failed_to_show";
  error?: string;
  amount?: number;
  currency?: string;
};

const nativeAds = NativeModules.YandexAds as NativeYandexAds | undefined;

function fallback(placement: RewardedAdPlacement, reason: RewardedAdReceipt["reason"]): RewardedAdReceipt {
  return { provider: "yandex", placement, completed: false, proof: "", reason };
}

class YandexRewardedAds {
  private initialized = false;
  private loaded = false;
  private initializing: Promise<boolean> | null = null;
  private loading: Promise<boolean> | null = null;

  constructor() {
    if (Platform.OS !== "android" || !nativeAds) return;
    DeviceEventEmitter.addListener(EVENT_NAME, (event: YandexEvent) => {
      if (event.type === "initialized") {
        console.log("[Yandex Ads] Yandex Ads SDK initialized");
      } else if (event.type === "loading") {
        console.log("[Yandex Ads] Rewarded ad loading");
      } else if (event.type === "loaded") {
        this.loaded = true;
        console.log("[Yandex Ads] Rewarded ad loaded");
      } else if (event.type === "shown") {
        console.log("[Yandex Ads] Rewarded ad shown");
      } else if (event.type === "reward") {
        console.log("[Yandex Ads] Reward earned", event.amount, event.currency);
      } else if (event.type === "closed") {
        this.loaded = false;
        console.log("[Yandex Ads] Rewarded ad closed");
      } else if (event.type === "failed" || event.type === "failed_to_show") {
        this.loaded = false;
        console.log(`[Yandex Ads] Rewarded ad failed: ${event.error ?? "Unknown error"}`);
      }
    });
  }

  async initialize(): Promise<boolean> {
    if (Platform.OS !== "android" || !nativeAds) return false;
    if (this.initialized) return true;
    if (this.initializing) return this.initializing;
    console.log(`[Yandex Ads] Initializing (${TEST_MODE ? "test" : "production"} placement)`);
    this.initializing = nativeAds
      .initialize(TEST_MODE ? TEST_AD_UNIT_ID : AD_UNIT_ID, __DEV__)
      .then((ready) => {
        this.initialized = ready;
        if (ready) void this.prepare();
        return ready;
      })
      .catch((error) => {
        console.log(`[Yandex Ads] Rewarded ad failed: ${String(error)}`);
        return false;
      })
      .finally(() => {
        this.initializing = null;
      });
    return this.initializing;
  }

  private async prepare(): Promise<boolean> {
    if (!nativeAds || !this.initialized) return false;
    if (this.loaded || (await nativeAds.isRewardedLoaded())) {
      this.loaded = true;
      return true;
    }
    if (this.loading) return this.loading;
    this.loading = new Promise<boolean>((resolve) => {
      let settled = false;
      const subscription = DeviceEventEmitter.addListener(EVENT_NAME, (event: YandexEvent) => {
        if (event.type !== "loaded" && event.type !== "failed") return;
        if (settled) return;
        settled = true;
        subscription.remove();
        clearTimeout(timeout);
        resolve(event.type === "loaded");
      });
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        subscription.remove();
        resolve(false);
      }, LOAD_TIMEOUT_MS);
      void nativeAds.loadRewarded().catch(() => {
        if (settled) return;
        settled = true;
        subscription.remove();
        clearTimeout(timeout);
        resolve(false);
      });
    }).finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  async show(placement: RewardedAdPlacement): Promise<RewardedAdReceipt> {
    if (!(await this.initialize()) || !(await this.prepare()) || !nativeAds) {
      console.log("[Yandex Ads] Rewarded ad failed: not ready");
      return fallback(placement, "unavailable");
    }
    this.loaded = false;
    try {
      const result = await nativeAds.showRewarded();
      return {
        provider: "yandex",
        placement,
        completed: result.completed,
        proof: result.proof,
        amount: result.amount,
        currency: result.currency,
        reason: result.reason,
      };
    } catch (error) {
      console.log(`[Yandex Ads] Rewarded ad failed: ${String(error)}`);
      return fallback(placement, "failed");
    }
  }

  diagnostics(): Pick<AdsDiagnostics, "configured" | "initialized" | "testMode" | "rewardedLoaded" | "sdkVersion"> {
    return {
      configured: Platform.OS === "android" && Boolean(nativeAds),
      initialized: this.initialized,
      testMode: TEST_MODE,
      rewardedLoaded: this.loaded,
      sdkVersion: null,
    };
  }
}

export const yandexRewardedAds = new YandexRewardedAds();