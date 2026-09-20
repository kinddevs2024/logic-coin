import { afterEach, expect, it, vi } from "vitest";
import { isTelegramMiniApp } from "../src/lib/telegram-context";

afterEach(() => vi.unstubAllGlobals());
it("is safe during native/server execution", () => {
  vi.stubGlobal("window", undefined);
  expect(isTelegramMiniApp()).toBe(false);
});
it("does not mistake the SDK in a normal browser for Telegram", () => {
  vi.stubGlobal("window", { Telegram: { WebApp: { initData: "", platform: "unknown" } }, location: { hash: "", search: "" } });
  expect(isTelegramMiniApp()).toBe(false);
});
it.each([
  { Telegram: { WebApp: { initData: "signed-data" } }, location: { hash: "", search: "" } },
  { Telegram: { WebApp: { platform: "android" } }, location: { hash: "", search: "" } },
  { location: { hash: "#tgWebAppPlatform=android", search: "" } },
])("recognizes Telegram before and after SDK initialization", (context) => {
  vi.stubGlobal("window", context);
  expect(isTelegramMiniApp()).toBe(true);
});
