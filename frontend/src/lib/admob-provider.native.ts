import { isExpoGo } from "./native-runtime";
import type { AdmobController } from "./admob";
const unavailable: AdmobController = {
  initialize: async () => false,
  preloadInterstitial: async () => {},
  showInterstitial: async () => ({ shown: false, reason: "unsupported" }),
  bannerUnitId: () => null,
};
export const admob: AdmobController = isExpoGo
  ? unavailable
  : require("./admob-provider.sdk").admob;
