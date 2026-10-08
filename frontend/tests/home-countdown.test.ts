import { describe, expect, it } from "vitest";
import { remainingTime } from "../src/lib/home-countdown";
describe("Home server countdown", () => {
  const start = "2026-10-08T10:00:00Z";
  it("uses server clock even when device clock differs", () => {
    expect(remainingTime("2026-10-08T10:01:00Z", start, 5000, 6000)).toBe("00:00:59");
  });
  it("recalculates elapsed time after background resume", () => {
    expect(remainingTime("2026-10-08T11:00:00Z", start, 5000, 1805000)).toBe("00:30:00");
  });
  it("never produces a negative timer", () => {
    expect(remainingTime(start, start, 1000, 2000)).toBe("00:00:00");
  });
  it("does not invent a deadline", () => {
    expect(remainingTime(null, start, 1000, 2000)).toBeNull();
    expect(remainingTime("invalid", start, 1000, 2000)).toBeNull();
  });
});
