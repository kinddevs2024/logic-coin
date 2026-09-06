import Appodeal, {
  AppodealAdType,
  AppodealInterstitialEvents,
  AppodealLogLevel,
  AppodealSdkEvents,
} from "react-native-appodeal";
import { Platform } from "react-native";

import type {
  AdsDiagnostics,
  InterstitialAdPlacement,
  RewardedAdPlacement,
  RewardedAdProvider,
  RewardedAdReceipt,
} from "./rewarded-ad";
import { yandexRewardedAds } from "./yandex-rewarded.native";

const APP_KEY = process.env.EXPO_PUBLIC_APPODEAL_APP_KEY?.trim() ?? "";
const TEST_MODE =
  __DEV__ || process.env.EXPO_PUBLIC_APPODEAL_TEST_MODE?.toLowerCase() === "true";
const AD_TYPES =
  AppodealAdType.INTERSTITIAL |
  AppodealAdType.BANNER;
const LOAD_TIMEOUT_MS = 15_000;
const SHOW_TIMEOUT_MS = 120_000;

type Subscription = { remove: () => void };

function createReceiptId(placement: RewardedAdPlacement) {
  const random = Math.random().toString(36).slice(2, 12);
  return `appodeal-${placement}-${Date.now()}-${random}`;
}

function waitForLoaded(type: AppodealAdType, loadedEvent: string, failedEvent: string) {
  if (Appodeal.isLoaded(type)) return Promise.resolve(true);
  Appodeal.cache(type);
  return new Promise<boolean>((resolve) => {
    const subscriptions: Subscription[] = [];
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      subscriptions.forEach((subscription) => subscription.remove());
      clearTimeout(timeout);
      resolve(value);
    };
    subscriptions.push(Appodeal.addEventListener(loadedEvent, () => finish(true)));
    subscriptions.push(Appodeal.addEventListener(failedEvent, () => finish(false)));
    timeout = setTimeout(() => finish(false), LOAD_TIMEOUT_MS);
  });
}

class AppodealRewardedAdProvider implements RewardedAdProvider {
  private initialized = false;
  private initializing: Promise<boolean> | null = null;
  private showingRewarded = false;
  private showingInterstitial = false;

  async initialize(userId?: string) {
    const [yandexReady, appodealReady] = await Promise.all([
      yandexRewardedAds.initialize(),
      this.initializeAppodeal(userId),
    ]);
    return yandexReady || appodealReady;
  }

  private initializeAppodeal(userId?: string) {
    if (userId) Appodeal.setUserId(userId);
    if (this.initialized) return Promise.resolve(true);
    if (this.initializing) return this.initializing;
    if (Platform.OS !== "android" || !APP_KEY) return Promise.resolve(false);

    this.initializing = new Promise<boolean>((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout>;
      const subscription = Appodeal.addEventListener(
        AppodealSdkEvents.INITIALIZED,
        () => finish(true),
      );
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        subscription.remove();
        clearTimeout(timeout);
        this.initialized = value;
        resolve(value);
      };
      timeout = setTimeout(
        () => finish(Appodeal.isInitialized(AD_TYPES)),
        LOAD_TIMEOUT_MS,
      );

      Appodeal.setTesting(TEST_MODE);
      Appodeal.setLogLevel(TEST_MODE ? AppodealLogLevel.VERBOSE : AppodealLogLevel.NONE);
      Appodeal.setChildDirectedTreatment(false);
      Appodeal.setSmartBanners(true);
      Appodeal.setBannerAnimation(true);
      Appodeal.initialize(APP_KEY, AD_TYPES);
    }).finally(() => {
      this.initializing = null;
    });

    return this.initializing;
  }

  async show(placement: RewardedAdPlacement): Promise<RewardedAdReceipt> {
    return yandexRewardedAds.show(placement);
  }

  async showInterstitial(placement: InterstitialAdPlacement) {
    if (this.showingInterstitial || !(await this.initializeAppodeal())) return false;
    const loaded = await waitForLoaded(
      AppodealAdType.INTERSTITIAL,
      AppodealInterstitialEvents.LOADED,
      AppodealInterstitialEvents.FAILED_TO_LOAD,
    );
    if (!loaded) return false;

    this.showingInterstitial = true;
    return new Promise<boolean>((resolve) => {
      let shown = false;
      let settled = false;
      let timeout: ReturnType<typeof setTimeout>;
      const subscriptions: Subscription[] = [];
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        this.showingInterstitial = false;
        subscriptions.forEach((subscription) => subscription.remove());
        clearTimeout(timeout);
        resolve(value);
      };
      subscriptions.push(
        Appodeal.addEventListener(AppodealInterstitialEvents.SHOWN, () => {
          shown = true;
        }),
      );
      subscriptions.push(
        Appodeal.addEventListener(AppodealInterstitialEvents.CLOSED, () => finish(shown)),
      );
      subscriptions.push(
        Appodeal.addEventListener(AppodealInterstitialEvents.FAILED_TO_SHOW, () =>
          finish(false),
        ),
      );
      timeout = setTimeout(() => finish(false), SHOW_TIMEOUT_MS);
      Appodeal.show(AppodealAdType.INTERSTITIAL, placement);
    });
  }

  diagnostics(): AdsDiagnostics {
    return {
      configured: Boolean(APP_KEY),
      initialized: yandexRewardedAds.diagnostics().initialized,
      testMode: yandexRewardedAds.diagnostics().testMode,
      rewardedLoaded: yandexRewardedAds.diagnostics().rewardedLoaded,
      interstitialLoaded:
        this.initialized && Appodeal.isLoaded(AppodealAdType.INTERSTITIAL),
      sdkVersion: yandexRewardedAds.diagnostics().sdkVersion,
    };
  }
}

export const rewardedAds: RewardedAdProvider = new AppodealRewardedAdProvider();
