import { describe, expect, it } from "vitest";
import { nextLoginSlot, periodRewardEligible } from "../src/lib/coin-reward-policy.js";
describe("coin gift policy", () => {
  it("starts at one, advances daily, loops after seven and resets after a miss", () => {
    expect(nextLoginSlot(null, "2026-10-10")).toBe(1);
    expect(nextLoginSlot({ dayKey: "2026-10-09", slot: 4 }, "2026-10-10")).toBe(5);
    expect(nextLoginSlot({ dayKey: "2026-10-09", slot: 7 }, "2026-10-10")).toBe(1);
    expect(nextLoginSlot({ dayKey: "2026-10-08", slot: 4 }, "2026-10-10")).toBe(1);
  });
  const month = { from: "2026-10-01", to: "2026-10-31" };
  const days = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
  it("allows exactly three missing monthly days, but not four", () => {
    expect(periodRewardEligible("month", month, month.to, month.from, days.slice(3)).eligible).toBe(true);
    expect(periodRewardEligible("month", month, month.to, month.from, days.slice(4)).eligible).toBe(false);
  });
  it("does not unlock monthly gifts early or before enrollment", () => {
    expect(periodRewardEligible("month", month, "2026-10-28", month.from, days).eligible).toBe(false);
    expect(periodRewardEligible("month", month, "2026-11-01", "2026-11-01", days).eligible).toBe(false);
  });
  it("requires every weekly day and does not double-count multiple games", () => {
    const week = { from: "2026-10-05", to: "2026-10-11" };
    const seven = days.slice(4, 11);
    expect(periodRewardEligible("week", week, week.to, week.from, seven).eligible).toBe(true);
    expect(periodRewardEligible("week", week, week.to, week.from, [...seven.slice(1), seven[1]!]).eligible).toBe(false);
  });
});
