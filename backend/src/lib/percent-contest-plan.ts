import { rankContestStandings, type ContestStandingInput } from "./contest.js";

export const PERCENT_CONTEST_POLICY = "all-six-percent-v1";
export const PERCENT_CONTEST_POOL_UNITS = 825;
export const MICROS_PER_CENT = 10_000;

// Percentile boundaries include the podium; all accounting here is integer USD micros.
export function percentContestPlan(standings: readonly ContestStandingInput[]) {
  const eligible = standings.filter(row => row.completedGamesCount === 6);
  const n = eligible.length;
  const bands = { participantCount: n, cashWinners: n, caseWinners: 0, randomWinners: 0, coinWinners: 0 };
  const ladderMicros = [2_500_000, 1_000_000, 500_000].slice(0, n);
  if (n > 3) {
    const percentages = [15, 30, 60, 100, 150, 1000];
    const budgets = [600_000, 600_000, 900_000, 800_000, 500_000, 850_000];
    const blocks: { count: number; budget: number }[] = [];
    let start = 3, emptyBudget = 0;
    percentages.forEach((boundary, i) => {
      const end = Math.min(n, Math.max(start, Math.ceil(n * boundary / 1000)));
      const count = end - start;
      if (count) blocks.push({ count, budget: budgets[i]! });
      else emptyBudget += budgets[i]!;
      start = end;
    });
    blocks[0]!.budget += emptyBudget;
    // Merge adjacent bands only when rounding/small cohorts would invert rank prizes.
    for (let i = 1; i < blocks.length;) {
      const a = blocks[i - 1]!, b = blocks[i]!;
      if (Math.floor(a.budget / a.count) < Math.ceil(b.budget / b.count)) {
        a.count += b.count; a.budget += b.budget; blocks.splice(i, 1);
        i = Math.max(1, i - 1);
      } else i++;
    }
    let carry = 0;
    for (const block of blocks) {
      const requested = block.budget + carry;
      const payable = Math.min(requested, block.count * 500_000);
      carry = requested - payable;
      const q = Math.floor(payable / block.count), r = payable % block.count;
      if (q === 0) throw new Error("Participant count exceeds supported monetary precision");
      for (let i = 0; i < block.count; i++) ladderMicros.push(q + (i < r ? 1 : 0));
    }
  }
  const distributedMicros = ladderMicros.reduce((sum, value) => sum + value, 0);
  const ladder = ladderMicros.map(value => value / MICROS_PER_CENT);
  const ranked = rankContestStandings(eligible, bands).map((row, i) => ({ ...row, cashUnits: ladder[i]!, cashMicros: ladderMicros[i]! }));
  return { bands, ranked, ladder, distributedUnits: distributedMicros / MICROS_PER_CENT,
    unallocatedUnits: (8_250_000 - distributedMicros) / MICROS_PER_CENT };
}
