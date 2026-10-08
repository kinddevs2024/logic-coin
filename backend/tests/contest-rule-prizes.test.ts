import { describe, expect, it } from "vitest";
import { contestPrizePlan } from "../src/lib/manual-contest-prizes.js";
import { summarizeDailyPrizes } from "../src/services/contest-rules.service.js";
const standings = [1, 2, 3, 4].map((rank) => ({ userId: String(rank).padStart(24, "0"), totalCoins: 1000 - rank, completedGamesCount: 6, finishedAt: null }));
describe("rule prize amounts use the payout allocation", () => {
  it("matches automatic payouts and changes with the administrator's pool", () => {
    for (const budget of [1000, 2300]) {
      const plan = contestPrizePlan(standings, { prizePoolUnits: budget, cashPrizeMinUnits: 0, cashPrizeMaxUnits: 0 });
      const summary = summarizeDailyPrizes(plan.ranked);
      expect(summary.podium.map(row => row.cashUnits)).toEqual(plan.ranked.slice(0, 3).map(row => row.cashUnits));
    }
  });
  it("uses manual recipient assignments, including zero cash for unassigned ranks", () => {
    const plan = contestPrizePlan(standings, { prizePoolUnits: 1000, cashPrizeMinUnits: 0, cashPrizeMaxUnits: 0, manualCashPrizes: [{ userId: standings[0]!.userId, cashUnits: 470 }, { userId: standings[2]!.userId, cashUnits: 90 }, { userId: standings[3]!.userId, cashUnits: 120 }] });
    expect(summarizeDailyPrizes(plan.ranked)).toEqual({ podium: [{ rank: 1, cashUnits: 470 }, { rank: 2, cashUnits: 0 }, { rank: 3, cashUnits: 90 }], otherMaxCashUnits: 120, cashWinnerCount: 3 });
  });
  it("does not invent prizes when no rank exists", () => {
    expect(summarizeDailyPrizes([]).podium.every(row => row.cashUnits === null)).toBe(true);
  });
});
