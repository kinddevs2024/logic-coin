import { describe, expect, it } from "vitest";
import { contestCashPlan } from "../src/lib/contest-cash-plan.js";
import { contestPrizePlan, validateManualCashPrizes } from "../src/lib/manual-contest-prizes.js";
import { DailyChallengeSet } from "../src/models/DailyChallengeSet.js";
import { contestNeighborhood } from "../src/lib/contest-neighbors.js";

describe("new challenge per-person cash cap", () => {
  it("shares the real $10 pool while no participant receives over $1", () => {
    for (const participants of [10, 11, 20, 28, 100, 1000]) {
      const plan = contestCashPlan(participants, 0, 0, 1000, 100);
      expect(plan.ladder.every(amount => Number.isInteger(amount) && amount > 0 && amount <= 100)).toBe(true);
      expect(plan.distributedUnits).toBe(1000);
      expect(plan.unallocatedUnits).toBe(0);
      expect(plan.bands.cashWinners + plan.bands.caseWinners + plan.bands.randomWinners + plan.bands.coinWinners).toBe(participants);
      expect(plan.ladder).toEqual([...plan.ladder].sort((a, b) => b - a));
    }
  });
  it("reports the surplus instead of overspending or pretending it was distributed", () => {
    for (let participants = 0; participants < 10; participants++) {
      const plan = contestCashPlan(participants, 0, 0, 1000, 100);
      expect(plan.distributedUnits).toBe(participants * 100);
      expect(plan.unallocatedUnits).toBe(1000 - participants * 100);
    }
  });
  it("conserves cents for small budgets and preserves uncapped legacy payouts", () => {
    for (let participants = 0; participants < 35; participants++) {
      for (const pool of [0, 1, 7, 99, 100, 101, 999, 1001]) {
        const plan = contestCashPlan(participants, 0, 0, pool, 100);
        expect(plan.distributedUnits + plan.unallocatedUnits).toBe(pool);
        expect(plan.distributedUnits).toBe(Math.min(pool, participants * 100));
        expect(plan.ladder.every(amount => amount <= 100)).toBe(true);
      }
    }
    const legacy = contestCashPlan(1, 0, 0, 1000);
    expect(legacy.ladder).toEqual([1000]);
    expect(new DailyChallengeSet().cashPrizeLimitUnits).toBeUndefined();
  });
  it("enforces the same cap on manual awards and ranking projections", () => {
    const userId = "000000000000000000000001";
    const standings = [{ userId, totalCoins: 100, completedGamesCount: 6, finishedAt: "2026-10-13T10:00:00.000Z" }];
    const settings = { prizePoolUnits: 1000, cashPrizeMinUnits: 0, cashPrizeMaxUnits: 0, cashPrizeLimitUnits: 100 };
    expect(() => validateManualCashPrizes([{ userId, cashUnits: 101 }], 1000, undefined, 100)).toThrow(/лимит/);
    expect(() => contestPrizePlan(standings, { ...settings, manualCashPrizes: [{ userId, cashUnits: 101 }] })).toThrow(/лимит/);
    expect(contestPrizePlan(standings, { ...settings, manualCashPrizes: [{ userId, cashUnits: 100 }] }).unallocatedUnits).toBe(900);
    expect(contestNeighborhood(standings, userId, 0, 0, 1000, null, 100).projectedCashUnits).toBe(100);
    expect(() => validateManualCashPrizes([{ userId, cashUnits: 1000 }], 1000)).not.toThrow();
  });
});
