import { isTelegramMiniApp } from "./telegram-context";
import type { AdsDiagnostics, InterstitialAdPlacement, RewardedAdPlacement, RewardedAdProvider, RewardedAdReceipt } from "./rewarded-ad";

export const MONETAG_ZONE = "12150927";
type AdResult = { reward_event_type?: "valued" | "non_valued" } | undefined;
type AdFunction = (options: { type: "end"; ymid: string; requestVar: string; timeout: number }) => Promise<AdResult>;
type AdWindow = Window & { show_12150927?: AdFunction; Telegram?: { WebApp?: { ready?: () => void } } };
let loading: Promise<boolean> | null = null;
let busy = false;

function scriptReady(src: string, attributes: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.logicLoaded === "1") { resolve(); return; }
    const script = existing ?? document.createElement("script");
    const finish = (error?: Error) => {
      clearTimeout(timer); script.removeEventListener("load", onLoad); script.removeEventListener("error", onError);
      if (error) { script.remove(); reject(error); } else { script.dataset.logicLoaded = "1"; resolve(); }
    };
    const onLoad = () => finish();
    const onError = () => finish(new Error("Ad SDK unavailable"));
    const timer = setTimeout(() => finish(new Error("Ad SDK timeout")), 15000);
    script.addEventListener("load", onLoad); script.addEventListener("error", onError);
    if (!existing) { script.src = src; script.async = true; for (const [key, value] of Object.entries(attributes)) script.setAttribute(key, value); document.head.appendChild(script); }
  });
}

export async function loadMonetag(): Promise<boolean> {
  if (!isTelegramMiniApp()) return false;
  const page = window as AdWindow;
  if (typeof page.show_12150927 === "function") return true;
  loading ??= (async () => {
    if (!page.Telegram?.WebApp) await scriptReady("https://telegram.org/js/telegram-web-app.js");
    page.Telegram?.WebApp?.ready?.();
    await scriptReady("https://libtl.com/sdk.js", { "data-zone": MONETAG_ZONE, "data-sdk": "show_12150927" });
    return typeof page.show_12150927 === "function";
  })().catch(() => false).finally(() => { loading = null; });
  return loading;
}

function proofId() { return `monetag-${globalThis.crypto.randomUUID()}`; }
function reserveInterstitial(now: number): boolean {
  try {
    const key = "logic-coin:monetag:interstitial:v1";
    const stored: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    const recent = (Array.isArray(stored) ? stored : []).filter((at): at is number => typeof at === "number" && at <= now && at > now - 360000);
    if (recent.length >= 2 || recent.some(at => now - at < 30000)) return false;
    sessionStorage.setItem(key, JSON.stringify([...recent, now]));
    return true;
  } catch { return false; }
}

export class WebRewardedAdProvider implements RewardedAdProvider {
  initialize() { return loadMonetag(); }
  async show(placement: RewardedAdPlacement, context?: { sessionId: string }): Promise<RewardedAdReceipt> {
    const receipt: RewardedAdReceipt = { provider: "monetag", placement, completed: false, proof: "", reason: "unavailable" };
    if (busy || !context?.sessionId || !(await this.initialize())) return receipt;
    if (busy) return receipt;
    busy = true;
    try {
      const result = await (window as AdWindow).show_12150927!({ type: "end", ymid: context.sessionId, requestVar: placement, timeout: 15 });
      if (result?.reward_event_type !== "valued") return { ...receipt, reason: "dismissed" };
      return { provider: "monetag", placement, completed: true, proof: proofId() };
    } catch { return { ...receipt, reason: "failed" }; }
    finally { busy = false; }
  }
  async showInterstitial(placement: InterstitialAdPlacement): Promise<boolean> {
    if (busy || !(await this.initialize()) || busy || !reserveInterstitial(Date.now())) return false;
    busy = true;
    try {
      await (window as AdWindow).show_12150927!({ type: "end", ymid: `interstitial-${globalThis.crypto.randomUUID()}`, requestVar: placement, timeout: 15 });
      return true;
    } catch { return false; }
    finally { busy = false; }
  }
  async showAppOpen() { return false; }
  diagnostics(): AdsDiagnostics {
    const initialized = typeof window !== "undefined" && typeof (window as AdWindow).show_12150927 === "function";
    return { configured: isTelegramMiniApp(), initialized, testMode: false, rewardedLoaded: initialized, interstitialLoaded: initialized, sdkVersion: initialized ? "monetag-tma" : null };
  }
}
export const rewardedAds: RewardedAdProvider = new WebRewardedAdProvider();
