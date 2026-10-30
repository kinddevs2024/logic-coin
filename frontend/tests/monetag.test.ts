import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebRewardedAdProvider, loadMonetag } from "../src/lib/rewarded-ad-provider.web";
const sessionId = "aaaabbbb-1111-4222-8333-444455556666";
let show: ReturnType<typeof vi.fn>;
beforeEach(() => {
  const stored = new Map<string,string>();
  show = vi.fn().mockResolvedValue({ reward_event_type: "valued" });
  vi.stubGlobal("window", { Telegram: { WebApp: { platform: "android", initData: "fixture" } }, location: { hash: "", search: "" }, show_12150927: show });
  vi.stubGlobal("sessionStorage", { getItem: (k:string) => stored.get(k) ?? null, setItem: (k:string,v:string) => stored.set(k,v) });
});
describe("Monetag Mini App integration", () => {
  it("does not load the SDK or show ads on the ordinary website", async () => {
    vi.stubGlobal("window", { location: { hash: "", search: "" } });
    expect(await loadMonetag()).toBe(false);
    expect((await new WebRewardedAdProvider().show("home-gift", { sessionId })).completed).toBe(false);
  });
  it("loads one SDK tag with the exact zone for concurrent initialization", async () => {
    delete (window as Window & { show_12150927?: unknown }).show_12150927;
    const listeners = new Map<string, () => void>();
    const attributes: Record<string,string> = {};
    const script = { dataset: {}, src: "", async: false, remove: vi.fn(), setAttribute: (k:string,v:string) => { attributes[k]=v; }, addEventListener: (k:string,f:()=>void) => listeners.set(k,f), removeEventListener: (k:string) => listeners.delete(k) };
    const appendChild = vi.fn(() => { (window as Window & { show_12150927?: unknown }).show_12150927 = show; queueMicrotask(() => listeners.get("load")?.()); });
    vi.stubGlobal("document", { querySelector: () => null, createElement: () => script, head: { appendChild } });
    expect(await Promise.all([loadMonetag(), loadMonetag()])).toEqual([true,true]);
    expect(appendChild).toHaveBeenCalledOnce(); expect(script.src).toBe("https://libtl.com/sdk.js");
    expect(attributes).toEqual({ "data-zone": "12150927", "data-sdk": "show_12150927" });
  });
  it("correlates every rewarded show with the server session and placement", async () => {
    const result = await new WebRewardedAdProvider().show("home-gift", { sessionId });
    expect(show).toHaveBeenCalledWith({ type: "end", ymid: sessionId, requestVar: "home-gift", timeout: 15 });
    expect(result).toMatchObject({ provider: "monetag", completed: true }); expect(result.proof).toMatch(/^monetag-/);
  });
  it.each([undefined, { reward_event_type: "non_valued" }])("does not reward an unvalued close: %j", async value => {
    show.mockResolvedValue(value);
    expect((await new WebRewardedAdProvider().show("home-gift", { sessionId })).completed).toBe(false);
  });
  it("does not show a reward without a server-issued session", async () => {
    expect((await new WebRewardedAdProvider().show("home-gift")).completed).toBe(false); expect(show).not.toHaveBeenCalled();
  });
  it("handles SDK failure without a reward and releases the global lock", async () => {
    show.mockRejectedValueOnce(new Error("Empty feed")); const provider = new WebRewardedAdProvider();
    expect((await provider.show("home-gift", { sessionId })).completed).toBe(false);
    expect((await provider.show("home-gift", { sessionId })).completed).toBe(true);
  });
  it("never starts autoplay, and caps after-game ads across component instances", async () => {
    const a = new WebRewardedAdProvider(), b = new WebRewardedAdProvider();
    await a.initialize(); await a.showAppOpen(); expect(show).not.toHaveBeenCalled();
    expect(await a.showInterstitial("game-complete")).toBe(true);
    expect(await b.showInterstitial("game-complete")).toBe(false);
    expect(show.mock.calls[0]?.[0].type).toBe("end"); expect(show.mock.calls[0]?.[0].ymid).toMatch(/^interstitial-/);
  });
});
