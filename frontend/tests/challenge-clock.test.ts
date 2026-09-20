import { describe, expect, it } from "vitest";
import { advanceChallengeClock, formatChallengeClock, MERGE_CHALLENGE_DURATION_MS } from "../src/games/challenge-clock";

describe("2048 challenge clock", () => {
  it("starts at exactly one minute", () => {
    expect(MERGE_CHALLENGE_DURATION_MS).toBe(60_000);
    expect(formatChallengeClock(60)).toBe("1:00");
  });
  it("finishes even when the browser delays timer callbacks", () => {
    expect(advanceChallengeClock(60_000, 59_999)).toBe(1);
    expect(advanceChallengeClock(60_000, 60_000)).toBe(0);
    expect(advanceChallengeClock(60_000, 90_000)).toBe(0);
  });
  it("does not add time after a backwards clock change", () => {
    expect(advanceChallengeClock(30_000, -1000)).toBe(30_000);
  });
  it("formats remaining seconds and zero", () => {
    expect(formatChallengeClock(9)).toBe("0:09");
    expect(formatChallengeClock(0)).toBe("0:00");
  });
});
