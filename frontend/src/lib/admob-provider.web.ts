import type { AdmobController, AdmobInterstitialResult } from "./admob";

class WebAdmobController implements AdmobController {
  async initialize() {
    return false;
  }

  async showInterstitial(): Promise<AdmobInterstitialResult> {
    return { shown: false, reason: "unsupported" };
  }

  bannerUnitId() {
    return null;
  }
}

export const admob: AdmobController = new WebAdmobController();
