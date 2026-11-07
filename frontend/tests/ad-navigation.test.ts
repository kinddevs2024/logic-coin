import { expect, it } from "vitest";
import { shouldShowNavigationAd } from "../src/lib/ad-navigation";
it("runs only between different content screens", () => {
  expect(shouldShowNavigationAd("/", "/challenges")).toBe(true);
  expect(shouldShowNavigationAd("/challenges", "/games")).toBe(true);
  for (const previous of [null, "/login", "/play/one-second", "/admin", "/raffle"]) {
    expect(shouldShowNavigationAd(previous, "/messages")).toBe(false);
  }
  expect(shouldShowNavigationAd("/messages", "/messages")).toBe(false);
  expect(shouldShowNavigationAd("/challenges", "/play/one-second")).toBe(false);
});
