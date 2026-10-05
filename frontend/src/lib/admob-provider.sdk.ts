import mobileAds, {
  AdEventType,
  AdsConsent,
  InterstitialAd,
  MaxAdContentRating,
} from "react-native-google-mobile-ads";

import {
  admobTestUnitId,
  admobUnitId,
  admobUsesLiveUnits,
} from "@/constants/admob";

import type {
  AdmobController,
  AdmobFailureReason,
  AdmobInterstitialResult,
} from "./admob";

const LOAD_TIMEOUT_MS = 15_000;
const SHOW_TIMEOUT_MS = 120_000;
/** One retry covers a transient no-fill without making the user wait long. */
const LOAD_RETRIES = 1;
const RETRY_DELAY_MS = 1_200;

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function debug(...args: unknown[]) {
  if (__DEV__) console.warn("[admob]", ...args);
}

type PresentOutcome = {
  shown: boolean;
  reason?: AdmobFailureReason;
  /** True once the ad actually appeared, so a later error is not a load failure. */
  opened: boolean;
};

class NativeAdmobController implements AdmobController {
  private startup: Promise<boolean> | null = null;
  private showing = false;
  private preloaded: InterstitialAd | null = null;
  private preloading: Promise<InterstitialAd | null> | null = null;

  async initialize() {
    this.startup ??= this.start().catch((error: unknown) => {
      debug("initialize failed", error);
      this.startup = null;
      return false;
    });
    return this.startup;
  }

  private async start() {
    // Consent must be resolved before the first ad request, but a failing
    // consent flow (offline, unsupported region, form error) must not block
    // ads entirely — the SDK then serves non-personalised inventory.
    try {
      const consent = await AdsConsent.gatherConsent();
      if (consent.canRequestAds === false) {
        debug("consent denied: ads cannot be requested");
        return false;
      }
    } catch (error) {
      debug("consent flow failed, continuing without it", error);
    }

    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds().initialize();
    debug("initialized", admobUsesLiveUnits() ? "live units" : "test units");
    return true;
  }

  /**
   * Loads an ad ahead of the tap. Failures are swallowed: `showInterstitial`
   * falls back to loading on demand.
   */
  async preloadInterstitial() {
    if (this.preloaded || this.preloading) return;
    if (!(await this.initialize())) return;
    this.preloading = this.load(admobUnitId("interstitial"))
      .catch(() => null)
      .finally(() => {
        this.preloading = null;
      });
    this.preloaded = await this.preloading;
  }

  async showInterstitial(): Promise<AdmobInterstitialResult> {
    if (this.showing) return { shown: false, reason: "already-showing" };
    if (!(await this.initialize())) return { shown: false, reason: "error" };

    this.showing = true;
    try {
      const primary = await this.attempt(admobUnitId("interstitial"));
      if (primary.shown || primary.opened) return this.toResult(primary);

      // A development build talking to live units always fails: emulators and
      // simulators are test devices and get no live inventory. Retrying on the
      // demo unit means the flow is still verifiable on a dev machine.
      if (__DEV__ && admobUsesLiveUnits()) {
        debug("live unit unavailable on this device, retrying with test unit");
        const fallback = await this.attempt(admobTestUnitId("interstitial"));
        if (fallback.shown || fallback.opened) return this.toResult(fallback);
      }
      return this.toResult(primary);
    } catch (error) {
      debug("showInterstitial threw", error);
      return { shown: false, reason: "error" };
    } finally {
      this.showing = false;
    }
  }

  private toResult(outcome: PresentOutcome): AdmobInterstitialResult {
    return outcome.reason
      ? { shown: outcome.shown, reason: outcome.reason }
      : { shown: outcome.shown };
  }

  /** Load (with retries) then present. */
  private async attempt(unitId: string): Promise<PresentOutcome> {
    for (let round = 0; round <= LOAD_RETRIES; round += 1) {
      const ad = this.takePreloaded(unitId) ?? (await this.load(unitId));
      if (ad) return this.present(ad);
      if (round < LOAD_RETRIES) await pause(RETRY_DELAY_MS);
    }
    return { shown: false, opened: false, reason: "no-fill" };
  }

  private takePreloaded(unitId: string) {
    const ad = this.preloaded;
    if (!ad || ad.adUnitId !== unitId || !ad.loaded) return null;
    this.preloaded = null;
    return ad;
  }

  private load(unitId: string) {
    return new Promise<InterstitialAd | null>((resolve) => {
      const ad = InterstitialAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: false,
      });
      const unsubscribers: (() => void)[] = [];
      let settled = false;

      const finish = (value: InterstitialAd | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        unsubscribers.forEach((unsubscribe) => unsubscribe());
        resolve(value);
      };

      const timeout = setTimeout(() => {
        debug("load timed out", unitId);
        finish(null);
      }, LOAD_TIMEOUT_MS);

      unsubscribers.push(
        ad.addAdEventListener(AdEventType.LOADED, () => finish(ad)),
      );
      unsubscribers.push(
        ad.addAdEventListener(AdEventType.ERROR, (error) => {
          debug("load failed", unitId, error);
          finish(null);
        }),
      );

      try {
        ad.load();
      } catch (error) {
        debug("load threw", unitId, error);
        finish(null);
      }
    });
  }

  private present(ad: InterstitialAd) {
    return new Promise<PresentOutcome>((resolve) => {
      const unsubscribers: (() => void)[] = [];
      let opened = false;
      let settled = false;

      const finish = (shown: boolean, reason?: AdmobFailureReason) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        unsubscribers.forEach((unsubscribe) => unsubscribe());
        resolve(reason ? { shown, opened, reason } : { shown, opened });
      };

      // From here on we are waiting for the user to dismiss a full-screen ad.
      const timeout = setTimeout(() => finish(opened, "timeout"), SHOW_TIMEOUT_MS);

      unsubscribers.push(
        ad.addAdEventListener(AdEventType.OPENED, () => {
          opened = true;
        }),
      );
      unsubscribers.push(
        ad.addAdEventListener(AdEventType.CLOSED, () => finish(true)),
      );
      unsubscribers.push(
        ad.addAdEventListener(AdEventType.ERROR, (error) => {
          debug("show failed", error);
          finish(opened, opened ? undefined : "error");
        }),
      );

      try {
        ad.show();
      } catch (error) {
        debug("show threw", error);
        finish(false, "error");
      }
    });
  }

  bannerUnitId() {
    return admobUnitId("banner");
  }
}

export const admob: AdmobController = new NativeAdmobController();
