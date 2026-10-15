import { expect, it } from "vitest";
import { contestCashPlan } from "../src/lib/contest-cash-plan.js";
import { DailyChallengeSet } from "../src/models/DailyChallengeSet.js";
import { contestPrizePlan } from "../src/lib/manual-contest-prizes.js";

it("keeps the first prize at one dollar and all later positive prizes strictly lower", () => {
  for (const participants of [1, 2, 3, 12, 28, 100, 1000]) {
    const plan = contestCashPlan(participants, 0, 0, 1000, 100, true);
    expect(plan.ladder[0]).toBe(100);
    plan.ladder.forEach((amount, index) => {
      expect(amount).toBeGreaterThan(0);
      if (index) expect(amount).toBeLessThan(plan.ladder[index - 1]!);
    });
    expect(plan.distributedUnits + plan.unallocatedUnits).toBe(1000);
  }
});

it("preserves existing contest allocations and never invents extra pool money", () => {
  expect(new DailyChallengeSet().descendingCashPrizes).toBeUndefined();
  expect(contestCashPlan(1, 0, 0, 1000).ladder).toEqual([1000]);
  for (const budget of [0, 1, 99, 100, 101, 1000]) {
    const plan = contestCashPlan(12, 0, 0, budget, 100, true);
    expect(plan.distributedUnits).toBeLessThanOrEqual(budget);
    expect(plan.distributedUnits + plan.unallocatedUnits).toBe(budget);
  }
});

it("rejects tied manual payouts under the new policy but leaves legacy manual prizes alone", () => {
  const standings = [1, 2].map((rank) => ({ userId: String(rank).padStart(24, "0"), totalCoins: 100 - rank, completedGamesCount: 6, finishedAt: new Date(rank).toISOString() }));
  const settings = { prizePoolUnits: 1000, cashPrizeMinUnits: 0, cashPrizeMaxUnits: 0, cashPrizeLimitUnits: 100,
    manualCashPrizes: standings.map(row => ({ userId: row.userId, cashUnits: 100 })) };
  expect(() => contestPrizePlan(standings, { ...settings, descendingCashPrizes: true })).toThrow();
  expect(() => contestPrizePlan(standings, settings)).not.toThrow();
});
