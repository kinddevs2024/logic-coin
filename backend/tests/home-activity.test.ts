import { describe, expect, it } from "vitest";
import { activityPeriod } from "../src/services/home-activity.service.js";

describe("home activity presentation", () => {
  it("keeps everyone eligible on the first day and does not count unfinished today as missed", () => {
    expect(activityPeriod("week", "2026-11-09", [])).toMatchObject({ missedDays: 0, eligible: true, percent: 0 });
    expect(activityPeriod("week", "2026-11-11", [])).toMatchObject({ missedDays: 2, eligible: true });
    expect(activityPeriod("week", "2026-11-12", [])).toMatchObject({ missedDays: 3, eligible: false });
  });
  it("allows four missed month days, excluding duplicate and future completions", () => {
    expect(activityPeriod("month", "2026-11-06", ["2026-11-01", "2026-11-01", "2026-11-07", "2026-10-31"])).toMatchObject({ completedDays: 1, missedDays: 4, eligible: true, percent: 3 });
    expect(activityPeriod("month", "2026-11-07", ["2026-11-01"])).toMatchObject({ missedDays: 5, eligible: false });
  });
  it("counts a completed today without reducing earlier misses", () => {
    expect(activityPeriod("week", "2026-11-12", ["2026-11-12"])).toMatchObject({ completedDays: 1, missedDays: 3, eligible: false, percent: 14 });
  });
  it("resets across year boundaries and supports leap February", () => {
    expect(activityPeriod("week", "2027-01-01", ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31"])).toMatchObject({ totalDays: 7, completedDays: 4, missedDays: 0 });
    expect(activityPeriod("month", "2024-02-29", [])).toMatchObject({ totalDays: 29, missedDays: 28 });
    expect(activityPeriod("month", "2024-03-01", ["2024-02-29"])).toMatchObject({ completedDays: 0, missedDays: 0, eligible: true });
  });
});
