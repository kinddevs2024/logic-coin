import { afterEach, expect, it, vi } from "vitest";
import { telegramChallengeInitData } from "../src/lib/telegram-context";
afterEach(() => vi.unstubAllGlobals());
it("keeps native WebSocket authentication safe without browser location or Telegram", () => {
  vi.stubGlobal("window", {});
  expect(telegramChallengeInitData()).toBeUndefined();
});
it("passes Telegram SDK launch data without fabricating it from URL flags", () => {
  vi.stubGlobal("window", { location: { hash: "#tgWebAppPlatform=android" } });
  expect(telegramChallengeInitData()).toBeUndefined();
  vi.stubGlobal("window", { Telegram: { WebApp: { initData: "signed-fixture" } } });
  expect(telegramChallengeInitData()).toBe("signed-fixture");
});
