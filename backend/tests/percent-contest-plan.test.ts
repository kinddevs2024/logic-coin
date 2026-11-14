import { describe, expect, it } from "vitest";
import { percentContestPlan, PERCENT_CONTEST_POLICY } from "../src/lib/percent-contest-plan.js";
import { contestPrizePlan } from "../src/lib/manual-contest-prizes.js";

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({
  userId: String(i + 1).padStart(24, "0"), totalCoins: n - i, completedGamesCount: 6, finishedAt: null,
}));
describe("percentile cash fund for six-game finishers", () => {
  it("reproduces the agreed 1,000-player table exactly", () => {
    const p = percentContestPlan(rows(1000));
    expect(p.ladder.slice(0, 3)).toEqual([250, 100, 50]);
    for (const [start, end, cents] of [[3,15,5],[15,30,4],[30,60,3],[60,100,2],[100,150,1],[150,1000,0.1]] as const) {
      expect(p.ladder.slice(start, end)).toEqual(Array(end - start).fill(cents));
    }
    expect(p.distributedUnits).toBe(825);
    expect(p.unallocatedUnits).toBe(0);
  });
  it("scales spending down for smaller cohorts without reallocating unused funds", () => {
    expect(percentContestPlan(rows(300)).distributedUnits).toBe(517.5);
    expect(percentContestPlan(rows(359)).distributedUnits).toBe(544.5);
    expect(percentContestPlan(rows(100)).distributedUnits).toBe(430.5);
    expect(percentContestPlan(rows(10)).distributedUnits).toBe(400.7);
    expect(contestPrizePlan(rows(300),{payoutPolicy:"all-six-percent-v1",prizePoolUnits:825,cashPrizeMinUnits:0,cashPrizeMaxUnits:250}).distributedUnits).toBe(825);
  });
  it("excludes partial finishers even when they have the most coins", () => {
    const p = contestPrizePlan([{...rows(1)[0]!, totalCoins: 1e9, completedGamesCount: 5}, ...rows(10).map(r => ({...r,userId:'x'+r.userId}))], {
      payoutPolicy: PERCENT_CONTEST_POLICY, prizePoolUnits: 825, cashPrizeMinUnits: 0, cashPrizeMaxUnits: 0,
    });
    expect(p.ranked).toHaveLength(10);
    expect(p.ranked.every(r => r.completedGamesCount === 6 && r.rewardType === "cash")).toBe(true);
    expect(p.ranked[0]!.totalCoins).toBe(10);
  });
  it("preserves exact totals, podium and rank order around every small-cohort boundary", () => {
    for (const n of [...Array.from({length: 1100}, (_, i) => i), 5000, 10000]) {
      const p = percentContestPlan(rows(n));
      expect(p.ladder).toHaveLength(n);
      expect(p.ladder.slice(0, 3)).toEqual([250, 100, 50].slice(0, n));
      expect(p.ranked.every(r => Number.isSafeInteger(r.cashMicros) && r.cashMicros > 0)).toBe(true);
      expect(p.distributedUnits).toBeLessThanOrEqual(825);
      expect(p.ranked.reduce((s,r)=>s+r.cashMicros,0)).toBe(Math.round(p.distributedUnits*10000));
      expect(p.ladder.every((value, i) => i === 0 || value <= p.ladder[i - 1]!)).toBe(true);
      if(n>=1000) expect(p.distributedUnits).toBe(825);
    }
  });
  it("does not change legacy plans or require a new policy on settled history", () => {
    const p=contestPrizePlan(rows(1000),{prizePoolUnits:1000,cashPrizeMinUnits:0,cashPrizeMaxUnits:0,cashPrizeLimitUnits:250,descendingCashPrizes:true});
    expect(p.bands.cashWinners).toBe(200);
    expect(p.distributedUnits).toBe(1000);
  });
});
