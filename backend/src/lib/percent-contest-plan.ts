import { rankContestStandings, type ContestStandingInput } from "./contest.js";

export const PERCENT_CONTEST_POLICY = "all-six-percent-v2";
export const PERCENT_CONTEST_POOL_UNITS = 825;
export const MICROS_PER_CENT = 10_000;

// Percentile boundaries include the podium; all accounting here is integer USD micros.
export function fixedPercentContestPlan(standings: readonly ContestStandingInput[]) {
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

// Fixed per-person amounts in percentile groups; $8.25 is a ceiling, not a spending target.
export function percentContestPlan(standings: readonly ContestStandingInput[]) {
  const eligible = standings.filter(row => row.completedGamesCount === 6);
  const n = eligible.length;
  const bands = { participantCount: n, cashWinners: n, caseWinners: 0, randomWinners: 0, coinWinners: 0 };
  const micros = [2_500_000, 1_000_000, 500_000].slice(0, n);
  let start = Math.min(3, n);
  const boundaries = [15, 30, 60, 100, 150, 1000];
  const amounts = [50_000, 40_000, 30_000, 20_000, 10_000, 1_000];
  boundaries.forEach((boundary, i) => {
    const end = Math.min(n, Math.max(start, Math.ceil(n * boundary / 1000)));
    for (let j = start; j < end; j++) micros.push(amounts[i]!);
    start = end;
  });
  const requested = micros.slice(3).reduce((s, v) => s + v, 0);
  if (requested > 4_250_000) {
    // Hamilton rounding within equal tiers, with higher ranks receiving remainders.
    const tail = micros.slice(3), cap = 4_250_000n, denominator = BigInt(requested);
    const values = tail.map(v => Number(BigInt(v) * cap / denominator));
    let remainder = 4_250_000 - values.reduce((s, v) => s + v, 0);
    const order = tail.map((v, i) => ({i, remainder: BigInt(v) * cap % denominator}))
      .sort((a,b) => a.remainder === b.remainder ? a.i-b.i : a.remainder > b.remainder ? -1 : 1);
    for (const row of order) { if (!remainder) break; values[row.i]!++; remainder--; }
    if (values.some(v => v <= 0)) throw new Error("Participant count exceeds supported monetary precision");
    for (let i = 0; i < values.length; i++) micros[i + 3] = values[i]!;
  }
  const total = micros.reduce((s, v) => s + v, 0);
  const ladder = micros.map(v => v / MICROS_PER_CENT);
  return { bands, ladder, ranked: rankContestStandings(eligible,bands).map((row,i)=>({...row,cashUnits:ladder[i]!,cashMicros:micros[i]!})),
    distributedUnits: total / MICROS_PER_CENT, unallocatedUnits: (8_250_000-total) / MICROS_PER_CENT };
}
