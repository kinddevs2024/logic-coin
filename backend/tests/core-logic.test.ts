import { describe, expect, it } from "vitest";
import {
  addDays,
  calculateGraceStreak,
  currentWeekBounds,
  isoWeekKey,
  parseDayKey
} from "../src/lib/date.js";
import { centsToUnits, unitsToCents } from "../src/lib/money.js";

describe("calendar logic", () => {
  it("preserves a streak with one missed day in an ISO week", () => {
    const result = calculateGraceStreak(
      ["2026-07-20", "2026-07-21", "2026-07-23", "2026-07-24"],
      "2026-07-24"
    );

    expect(result).toMatchObject({
      activeDays: 4,
      calendarSpanDays: 5,
      graceDaysUsed: 1,
      lastActiveDay: "2026-07-24"
    });
  });

  it("breaks a streak on the second missed day in the same week", () => {
    const result = calculateGraceStreak(
      ["2026-07-20", "2026-07-21", "2026-07-24"],
      "2026-07-24"
    );

    expect(result.activeDays).toBe(1);
    expect(result.calendarSpanDays).toBe(2);
  });

  it("handles day and ISO week boundaries deterministically", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(parseDayKey("2024-02-29").toISOString().slice(0, 10)).toBe("2024-02-29");
    expect(() => parseDayKey("2025-02-29")).toThrow();
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01");
    expect(currentWeekBounds("2026-07-24")).toEqual({
      from: "2026-07-20",
      to: "2026-07-26"
    });
  });
});

describe("integer economy", () => {
  it("converts only integer units and cents", () => {
    expect(unitsToCents(123)).toBe(123);
    expect(centsToUnits(1_000)).toBe(1_000);
    expect(() => unitsToCents(1.2)).toThrow();
  });
});
