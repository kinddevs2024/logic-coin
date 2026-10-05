import { describe, expect, it } from "vitest";
import { contestPrizePlan, validateManualCashPrizes } from "../src/lib/manual-contest-prizes.js";
import { contestCashPlan } from "../src/lib/contest-cash-plan.js";
import { contestNeighborhood } from "../src/lib/contest-neighbors.js";
const id = (n: number) => n.toString(16).padStart(24, "0");
const standings = Array.from({ length: 6 }, (_, n) => ({ userId: id(n + 1), totalCoins: 600 - n * 100, completedGamesCount: 6, finishedAt: null }));
const settings = { cashPrizeMinUnits: 50, cashPrizeMaxUnits: 2500, prizePoolUnits: 10_000 };
describe("manual contest cash prizes", () => {
  it("preserves automatic allocation when no manual plan is set", () => {
    const plan = contestPrizePlan(standings, settings);
    expect(plan.ranked.map(row => row.cashUnits).filter(Boolean)).toEqual(contestCashPlan(6, 50, 2500, 10_000).ladder);
    expect(plan.distributedUnits).toBe(10_000);
  });
  it("assigns by user ID even outside the automatic top 50 percent", () => {
    const plan = contestPrizePlan(standings, { ...settings, manualCashPrizes: [{ userId: id(6), cashUnits: 100 }, { userId: id(1), cashUnits: 2500 }] });
    expect(plan.ranked[5]).toMatchObject({ rank: 6, cashUnits: 100, rewardType: "cash", totalCoins: 100 });
    expect(plan.ranked[1]).toMatchObject({ cashUnits: 0, rewardType: "coins" });
    expect(plan.distributedUnits).toBe(2600);
    expect(plan.unallocatedUnits).toBe(7400);
    expect(plan.bands.cashWinners).toBe(2);
  });
  it("follows users when ranks change, not their old places", () => {
    const plan = contestPrizePlan([...standings].map(row => ({ ...row, totalCoins: row.userId === id(6) ? 1000 : row.totalCoins })), { ...settings, manualCashPrizes: [{ userId: id(6), cashUnits: 777 }] });
    expect(plan.ranked[0]).toMatchObject({ userId: id(6), rank: 1, cashUnits: 777 });
  });
  it("shows the same custom amount in a participant's projected prize", () => {
    const preview = contestNeighborhood(standings, id(6), 50, 2500, 10_000, [{ userId: id(6), cashUnits: 125 }]);
    expect(preview.projectedCashUnits).toBe(125);
  });
  it("allows zero cash and leaves new participants without unassigned money", () => {
    const plan = contestPrizePlan(standings, { ...settings, manualCashPrizes: [] });
    expect(plan.distributedUnits).toBe(0);
    expect(plan.bands.cashWinners).toBe(0);
  });
  it("rejects a plan larger than the pool and a later pool reduction", () => {
    expect(() => validateManualCashPrizes([{ userId: id(1), cashUnits: 10_001 }], 10_000)).toThrow(/фонд/);
    expect(() => contestPrizePlan(standings, { ...settings, prizePoolUnits: 99, manualCashPrizes: [{ userId: id(1), cashUnits: 100 }] })).toThrow(/фонд/);
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid cents %s", cashUnits => {
    expect(() => validateManualCashPrizes([{ userId: id(1), cashUnits }], 10_000)).toThrow();
  });
  it("rejects duplicates and nonparticipants", () => {
    expect(() => validateManualCashPrizes([{ userId: id(1), cashUnits: 1 }, { userId: id(1), cashUnits: 2 }], 100)).toThrow();
    expect(() => validateManualCashPrizes([{ userId: id(9), cashUnits: 1 }], 100, new Set(standings.map(row => row.userId)))).toThrow(/участнику/);
  });
  it("retains exact cents and permits the whole budget", () => {
    const plan = contestPrizePlan(standings, { ...settings, manualCashPrizes: [{ userId: id(2), cashUnits: 9999 }, { userId: id(6), cashUnits: 1 }] });
    expect(plan.distributedUnits).toBe(10_000);
    expect(plan.unallocatedUnits).toBe(0);
  });
});
