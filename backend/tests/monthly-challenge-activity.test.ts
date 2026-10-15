import { describe, expect, it } from "vitest";
import { countCompletedMonthDays, countCompletedWeekDays } from "../src/services/monthly-challenge-activity.service.js";
const games = ["a", "b", "c", "d", "e", "f"];
describe("fully completed monthly challenge days", () => {
  it("counts all six distinct required games, not repeated completions", () => {
    const sets = [{ dayKey: "2026-10-01", gameIds: games }, { dayKey: "2026-10-02", gameIds: games }];
    const attempts = [...games.map(gameId => ({ dayKey: "2026-10-01", gameId })), ...Array.from({ length: 6 }, () => ({ dayKey: "2026-10-02", gameId: "a" }))];
    expect(countCompletedMonthDays("2026-10-08", attempts, sets, [])).toEqual({ completedDays: 1, daysInMonth: 31 });
  });
  it("does not count unrelated games or future/out-of-month days", () => {
    expect(countCompletedMonthDays("2026-10-08", games.map(gameId => ({ dayKey: "2026-10-01", gameId: gameId + "x" })), [{ dayKey: "2026-10-01", gameIds: games }], ["2026-09-30", "2026-10-09"])).toEqual({ completedDays: 0, daysInMonth: 31 });
  });
  it("uses saved completed days without double counting and supports February", () => {
    expect(countCompletedMonthDays("2026-02-28", games.map(gameId => ({ dayKey: "2026-02-01", gameId })), [{ dayKey: "2026-02-01", gameIds: games }], ["2026-02-01", "2026-02-02"])).toEqual({ completedDays: 2, daysInMonth: 28 });
    expect(countCompletedMonthDays("2024-02-29", [], [], []).daysInMonth).toBe(29);
  });
  it("counts a Monday-to-Sunday week across the month boundary, excluding future days", () => {
    expect(countCompletedWeekDays("2026-10-01", [], [], ["2026-09-27", "2026-09-28", "2026-09-30", "2026-10-01", "2026-10-02"])).toBe(3);
  });
});
