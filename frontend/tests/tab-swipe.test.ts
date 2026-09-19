import { describe, expect, it } from "vitest";
import { tabSwipe } from "../src/lib/tab-swipe";
describe("tab swipes", () => {
  it("opens the left drawer and traverses tabs without wrapping", () => {
    expect(tabSwipe("/", 100, 0, 200)).toBe("drawer");
    expect(tabSwipe("/", -100, 0, 200)).toBe("/challenges");
    expect(tabSwipe("/challenges", -100, 0, 200)).toBe("/games");
    expect(tabSwipe("/games", -100, 0, 200)).toBe("/profile");
    expect(tabSwipe("/profile", -100, 0, 200)).toBeNull();
    expect(tabSwipe("/profile", 100, 0, 200)).toBe("/games");
  });
  it("ignores games, short, diagonal and slow drags", () => {
    expect(tabSwipe("/play/udar", -100, 0, 200)).toBeNull();
    expect(tabSwipe("/", 40, 0, 200)).toBeNull();
    expect(tabSwipe("/", 100, 100, 200)).toBeNull();
    expect(tabSwipe("/", 100, 0, 900)).toBeNull();
  });
  it("refreshes only home with a deliberate upward flick", () => {
    expect(tabSwipe("/", 0, -130, 200)).toBe("refresh");
    expect(tabSwipe("/games", 0, -130, 200)).toBeNull();
    expect(tabSwipe("/", 0, 130, 200)).toBeNull();
  });
});
