import { describe, expect, it } from "vitest";
import { evaluateSwipe } from "../src/games/bottle-flip/engine";
import { gameCoinReward } from "../src/games/rewards";
import { BOTTLE_THEME_PRICES, bottleThemeOwnership } from "../src/games/bottle-flip/pricing";
const gesture = { dx: 0, dy: -110, durationMs: 250, sceneHeight: 400, sceneWidth: 340 };
describe("bottle swipe", () => {
  it("locks free prototype themes once, preserving subsequent purchases", () => {
    expect(bottleThemeOwnership({ unlockedCosmetics: ["classic", "amber", "violet"], selectedCosmetic: "violet" }).unlockedCosmetics).toEqual(["classic"]);
    expect(bottleThemeOwnership({ bottleThemePricingVersion: 1, unlockedCosmetics: ["classic", "amber"], selectedCosmetic: "amber" }).selectedCosmetic).toBe("amber");
    expect(BOTTLE_THEME_PRICES).toEqual({ classic: 0, amber: 500, violet: 1500 });
  });
  it("earns 50 practice coins only for landing upright", () => {
    expect(gameCoinReward(100, true, "bottle-flip")).toBe(50);
    expect(gameCoinReward(100, false, "bottle-flip")).toBe(0);
    expect(gameCoinReward(100, true, "2048")).toBe(20);
  });
  it("uses swipe speed", () => {
    expect(evaluateSwipe(gesture)?.landed).toBe(true);
    expect(evaluateSwipe({ ...gesture, durationMs: 1000 })?.verdict).toBe("weak");
    expect(evaluateSwipe({ ...gesture, durationMs: 90 })?.verdict).toBe("strong");
  });
  it("requires landing on the table", () => { expect(evaluateSwipe({ ...gesture, dx: 160 })?.verdict).toBe("side"); });
  it("rejects tapping and invalid gestures", () => {
    for (const patch of [{ dy: 0 }, { dy: 80 }, { durationMs: 0 }, { dx: NaN }, { sceneHeight: 0 }]) expect(evaluateSwipe({ ...gesture, ...patch })).toBeNull();
  });
  it("normalizes screen sizes", () => { expect(evaluateSwipe({ ...gesture, dy: -220, sceneHeight: 800, sceneWidth: 680 })?.landed).toBe(true); });
});
