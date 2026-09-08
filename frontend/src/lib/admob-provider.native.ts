import mobileAds, {
  AdEventType,
  AdsConsent,
  InterstitialAd,
  MaxAdContentRating,
} from "react-native-google-mobile-ads";

import { admobUnitId } from "@/constants/admob";

import type {
  AdmobController,
  AdmobFailureReason,
  AdmobInterstitialResult,
} from "./admob";

const LOAD_TIMEOUT_MS = 15_000;
const SHOW_TIMEOUT_MS = 120_000;

class NativeAdmobController implements AdmobController {
  private startup: Promise<boolean> | null = null;
  private showing = false;

  async initialize() {
    this.startup ??= this.start().catch(() => {
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
      if (consent.canRequestAds === false) return false;
    } catch {
      // ignore and continue with a plain SDK start
    }

    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds().initialize();
    return true;
  }

  async showInterstitial(): Promise<AdmobInterstitialResult> {
    if (this.showing) return { shown: false, reason: "already-showing" };

    if (!(await this.initialize())) return { shown: false, reason: "error" };

    this.showing = true;
    try {
      return await this.present(admobUnitId("interstitial"));
    } catch {
      return { shown: false, reason: "error" };
    } finally {
      this.showing = false;
    }
  }

  private present(unitId: string) {
    return new Promise<AdmobInterstitialResult>((resolve) => {
      const interstitial = InterstitialAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      const unsubscribers: (() => void)[] = [];
      let opened = false;
      let settled = false;
      let timeout: ReturnType<typeof setTimeout>;

      const finish = (shown: boolean, reason?: AdmobFailureReason) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        unsubscribers.forEach((unsubscribe) => unsubscribe());
        resolve(reason ? { shown, reason } : { shown });
      };

      timeout = setTimeout(() => finish(false, "timeout"), LOAD_TIMEOUT_MS);

      unsubscribers.push(
        interstitial.addAdEventListener(AdEventType.LOADED, () => {
          // The load timer is replaced by a much longer one: from here on we
          // are waiting for the user to dismiss a full-screen ad.
          clearTimeout(timeout);
          timeout = setTimeout(() => finish(opened, "timeout"), SHOW_TIMEOUT_MS);
          try {
            interstitial.show();
          } catch {
            finish(false, "error");
          }
        }),
      );
      unsubscribers.push(
        interstitial.addAdEventListener(AdEventType.OPENED, () => {
          opened = true;
        }),
      );
      unsubscribers.push(
        interstitial.addAdEventListener(AdEventType.CLOSED, () => finish(true)),
      );
      unsubscribers.push(
        interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
          if (__DEV__) {
            console.warn("[admob] interstitial failed", unitId, error);
          }
          finish(opened, opened ? undefined : "no-fill");
        }),
      );

      try {
        interstitial.load();
      } catch {
        finish(false, "error");
      }
    });
  }

  bannerUnitId() {
    return admobUnitId("banner");
  }
}

export const admob: AdmobController = new NativeAdmobController();
