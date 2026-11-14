import { describe, expect, it } from "vitest";
import { contestPrizePlan } from "../src/lib/manual-contest-prizes.js";
import { newContestPayoutSeed, topTenContestPlan, TOP_TEN_CASH_MICROS, TOP_TEN_CONTEST_POLICY } from "../src/lib/top-ten-contest-plan.js";

const seed = "ab".repeat(32);
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({
  userId: String(i + 1).padStart(24, "0"), totalCoins: n - i, completedGamesCount: 6, finishedAt: null,
}));
const awardsByUser = (input: ReturnType<typeof rows>) => Object.fromEntries(topTenContestPlan(input, seed).ranked.map(row => [row.userId, row.cashMicros]));

describe("versioned top-ten and variable-tail daily cash prizes", () => {
  it("allocates exactly $8.25 to 1,500 finishers with the approved fixed top ten and percentile bands", () => {
    const plan = topTenContestPlan(rows(1500), seed);
    expect(plan.ranked.slice(0, 10).map(row => row.cashMicros)).toEqual(TOP_TEN_CASH_MICROS);
    for (const [start, end, micros] of [[10,45,10000],[45,90,3500],[90,150,2000],[150,225,1600]] as const) {
      expect(plan.ranked.slice(start, end).map(row => row.cashMicros)).toEqual(Array(end - start).fill(micros));
    }
    const tail = plan.ranked.slice(225).map(row => row.cashMicros);
    expect(tail).toHaveLength(1275);
    expect(tail.reduce((sum, value) => sum + value, 0)).toBe(1_402_500);
    expect(tail.every(value => value >= 1001 && value <= 1595)).toBe(true);
    expect(new Set(tail).size).toBeGreaterThan(250);
    expect(new Set(tail.map(value => value % 10)).size).toBe(10);
    expect(plan.distributedUnits).toBe(825);
    expect(plan.unallocatedUnits).toBe(0);
  });

  it("keeps bonuses stable across repeated reads, input order, and score changes within the same tail cohort", () => {
    const input = rows(1500);
    const first = awardsByUser(input);
    expect(awardsByUser(input)).toEqual(first);
    expect(awardsByUser([...input].reverse())).toEqual(first);
    const reorderedTail = input.map((row, index) => index < 225 ? row : { ...row, totalCoins: index - 224 });
    expect(awardsByUser(reorderedTail)).toEqual(first);
    const otherDraw = topTenContestPlan(input, "cd".repeat(32));
    expect(otherDraw.ranked.slice(0, 225)).toEqual(topTenContestPlan(input, seed).ranked.slice(0, 225));
    expect(otherDraw.ranked.slice(225).map(row => row.cashMicros)).not.toEqual(topTenContestPlan(input, seed).ranked.slice(225).map(row => row.cashMicros));
    expect(otherDraw.distributedUnits).toBe(825);
  });

  it("only pays users who completed all six games, through the shared settlement allocation", () => {
    const partials = [0,1,5,7].map(count => ({ ...rows(1)[0]!, userId: `partial-${count}`, totalCoins: 1e9, completedGamesCount: count }));
    const plan = contestPrizePlan([...partials, ...rows(1500)], {
      payoutPolicy: TOP_TEN_CONTEST_POLICY, payoutSeed: seed, prizePoolUnits: 825, cashPrizeMinUnits: 0, cashPrizeMaxUnits: 250,
    });
    expect(plan.bands.cashWinners).toBe(1500);
    expect(plan.ranked.every(row => row.completedGamesCount === 6 && row.rewardType === "cash")).toBe(true);
    expect(plan.distributedUnits).toBe(825);
  });

  it("spends less for smaller cohorts, leaving unused funds unspent", () => {
    expect(topTenContestPlan(rows(1000), seed).distributedUnits).toBe(750);
    expect(topTenContestPlan(rows(300), seed).distributedUnits).toBe(645.65);
    let previous = 0;
    for (let n = 0; n <= 1505; n++) {
      const plan = topTenContestPlan(rows(n), seed);
      expect(plan.ranked).toHaveLength(n);
      expect(plan.ranked.slice(0, 10).map(row => row.cashMicros)).toEqual(TOP_TEN_CASH_MICROS.slice(0, n));
      expect(plan.ranked.every(row => Number.isSafeInteger(row.cashMicros) && row.cashMicros > 0)).toBe(true);
      const total = plan.ranked.reduce((sum, row) => sum + row.cashMicros, 0);
      expect(total).toBe(Math.round(plan.distributedUnits * 10000));
      expect(total).toBeGreaterThanOrEqual(previous);
      expect(total).toBeLessThanOrEqual(8_250_000);
      if (n < 1500) expect(total).toBeLessThan(8_250_000);
      else expect(total).toBe(8_250_000);
      previous = total;
    }
  }, 30_000);

  it("caps larger cohorts while preserving top ten, exact totals and positive microdollar awards", () => {
    for (const n of [1501, 5000, 10000]) {
      const plan = topTenContestPlan(rows(n), seed);
      expect(plan.ranked.slice(0, 10).map(row => row.cashMicros)).toEqual(TOP_TEN_CASH_MICROS);
      expect(plan.ranked.slice(10).reduce((sum, row) => sum + row.cashMicros, 0)).toBe(2_150_000);
      expect(plan.ranked.every(row => Number.isSafeInteger(row.cashMicros) && row.cashMicros > 0)).toBe(true);
      expect(plan.distributedUnits).toBe(825);
      expect(plan).toEqual(topTenContestPlan(rows(n), seed));
      const reorderedTail = rows(n).map((row, index) => index < Math.ceil(n * 0.15) ? row : { ...row, totalCoins: index - Math.ceil(n * 0.15) + 1 });
      expect(awardsByUser(reorderedTail)).toEqual(awardsByUser(rows(n)));
    }
  });

  it("fails closed instead of silently generating a new draw when the saved seed is missing", () => {
    expect(newContestPayoutSeed()).toMatch(/^[a-f0-9]{64}$/);
    expect(newContestPayoutSeed()).not.toBe(newContestPayoutSeed());
    for (const invalid of [null, undefined, "", "bad", "z".repeat(64)]) {
      expect(() => topTenContestPlan(rows(11), invalid)).toThrow("persisted payout seed");
    }
    expect(() => topTenContestPlan([...rows(1), ...rows(1)], seed)).toThrow("Duplicate");
  });
});
