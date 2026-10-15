import { describe, expect, it } from "vitest";
import { bonusDay, DAILY_BONUS_DELAYS_MS, DAILY_BONUS_LIMIT, nextBonusDeadline } from "../src/lib/daily-bonus-schedule.js";

describe("daily bonus schedule", () => {
  it("uses exactly the ten approved waits", () => {
    expect(DAILY_BONUS_LIMIT).toBe(10);
    expect(DAILY_BONUS_DELAYS_MS.map(delay => delay / 60_000)).toEqual([2, 5, 15, 30, 60, 120, 180, 240, 300, 420]);
  });
  it("starts the next wait from the successful claim", () => {
    const now = new Date("2026-10-09T03:00:00Z");
    expect(nextBonusDeadline(now, 0).getTime() - now.getTime()).toBe(120_000);
    expect(nextBonusDeadline(now, 1).getTime() - now.getTime()).toBe(300_000);
    expect(nextBonusDeadline(now, 2).getTime() - now.getTime()).toBe(900_000);
  });
  it("resets at Tashkent midnight rather than server midnight", () => {
    expect(bonusDay(new Date("2026-10-09T18:59:59Z")).dayKey).toBe("2026-10-09");
    expect(bonusDay(new Date("2026-10-09T19:00:00Z")).dayKey).toBe("2026-10-10");
    expect(bonusDay(new Date("2026-10-09T12:00:00Z")).resetsAt.toISOString()).toBe("2026-10-09T19:00:00.000Z");
  });
  it("does not carry a previous day's wait across midnight", () => {
    expect(nextBonusDeadline(new Date("2026-10-09T18:59:00Z"), 9).toISOString()).toBe("2026-10-09T19:00:00.000Z");
    expect(nextBonusDeadline(new Date("2026-10-09T18:00:00Z"), 10).toISOString()).toBe("2026-10-09T19:00:00.000Z");
  });
});
