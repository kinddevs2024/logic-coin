import { afterEach, expect, it, vi } from "vitest";
const native=vi.hoisted(()=>({initialize:vi.fn(),isRewardedLoaded:vi.fn(),loadRewarded:vi.fn(),showRewarded:vi.fn()}));
vi.mock("react-native",()=>({Platform:{OS:"android"},NativeModules:{YandexAds:native},DeviceEventEmitter:{addListener:()=>({remove:()=>{}})}}));
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it("recognizes an ad that loads between the readiness check and event subscription",async()=>{
 vi.useFakeTimers();vi.stubGlobal("__DEV__",false);
 native.initialize.mockResolvedValue(true);
 native.isRewardedLoaded.mockResolvedValueOnce(false).mockResolvedValue(true);
 native.loadRewarded.mockResolvedValue(true);
 native.showRewarded.mockResolvedValue({completed:true,proof:"verified"});
 const {yandexRewardedAds}=await import("../src/lib/yandex-rewarded.native");
 await yandexRewardedAds.initialize();
 await vi.advanceTimersByTimeAsync(0);
 const result=await yandexRewardedAds.show("home-gift");
 expect(result.completed).toBe(true);
 expect(native.isRewardedLoaded.mock.calls.length).toBeGreaterThanOrEqual(2);
 expect(native.loadRewarded).not.toHaveBeenCalled();
 expect(native.showRewarded).toHaveBeenCalledOnce();
});

const appodeal = vi.hoisted(() => ({ initialize: vi.fn(), setTesting: vi.fn() }));
vi.mock("react-native-appodeal", () => ({
  default: appodeal,
  AppodealAdType: { INTERSTITIAL: 1, BANNER: 2, REWARDED_VIDEO: 4 },
  AppodealInterstitialEvents: {},
  AppodealRewardedEvents: {},
  AppodealLogLevel: {},
  AppodealSdkEvents: {},
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});

it("returns unavailable when the native SDK initialization never resolves", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("__DEV__", false);
  native.initialize.mockImplementation(() => new Promise(() => {}));
  const { yandexRewardedAds } = await import("../src/lib/yandex-rewarded.native");

  const result = yandexRewardedAds.show("home-gift");
  await vi.advanceTimersByTimeAsync(15_000);
  await expect(result).resolves.toMatchObject({ completed: false, reason: "unavailable", proof: "" });
  expect(native.showRewarded).not.toHaveBeenCalled();
});

it("keeps a valid long native ad eligible to complete", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("__DEV__", false);
  native.initialize.mockResolvedValue(true);
  native.isRewardedLoaded.mockResolvedValue(true);
  native.showRewarded.mockImplementation(() =>
    new Promise(resolve => setTimeout(() => resolve({ completed: true, proof: "valid-reward" }), 119_000)));
  const { yandexRewardedAds } = await import("../src/lib/yandex-rewarded.native");

  const result = yandexRewardedAds.show("home-gift");
  await vi.advanceTimersByTimeAsync(119_000);
  await expect(result).resolves.toMatchObject({ completed: true, proof: "valid-reward" });
  expect(native.showRewarded).toHaveBeenCalledOnce();
});

it("does not start a fallback ad or credit a late native result after timeout", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("__DEV__", false);
  vi.stubEnv("EXPO_PUBLIC_APPODEAL_APP_KEY", "fixture");
  native.initialize.mockResolvedValue(true);
  native.isRewardedLoaded.mockResolvedValue(true);
  native.showRewarded.mockImplementation(() =>
    new Promise(resolve => setTimeout(() => resolve({ completed: true, proof: "late" }), 126_000)));
  const { rewardedAds } = await import("../src/lib/rewarded-ad-provider.sdk");

  const result = rewardedAds.show("home-gift");
  await vi.advanceTimersByTimeAsync(125_000);
  await expect(result).resolves.toMatchObject({ completed: false, reason: "timeout", proof: "" });
  await vi.advanceTimersByTimeAsync(1000);
  await expect(result).resolves.toMatchObject({ completed: false, reason: "timeout", proof: "" });
  expect(native.showRewarded).toHaveBeenCalledOnce();
  expect(appodeal.initialize).not.toHaveBeenCalled();
});
