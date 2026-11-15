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
