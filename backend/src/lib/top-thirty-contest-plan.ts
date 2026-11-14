import { fixedPodiumLadder } from "./contest-cash-plan.js";
import { computeContestBands, rankContestStandings, type ContestStandingInput } from "./contest.js";

export const TOP_THIRTY_CONTEST_POLICY = "top-thirty-v1";

// Restore the fixed-podium allocation, widening only its paid band to 30%.
export function topThirtyContestPlan(standings: readonly ContestStandingInput[], budget: number) {
  const ladder = fixedPodiumLadder(standings.length, budget, 30);
  const base = computeContestBands(standings.length);
  const cashWinners = ladder.length;
  const caseWinners = Math.max(0, base.cashWinners + base.caseWinners - cashWinners);
  const randomWinners = Math.max(0, base.cashWinners + base.caseWinners + base.randomWinners - cashWinners - caseWinners);
  const bands = { participantCount: standings.length, cashWinners, caseWinners, randomWinners,
    coinWinners: standings.length - cashWinners - caseWinners - randomWinners };
  const distributedUnits = ladder.reduce((sum, value) => sum + value, 0);
  return { bands, ladder, distributedUnits, unallocatedUnits: budget - distributedUnits,
    ranked: rankContestStandings(standings, bands).map(row => ({ ...row, cashUnits: ladder[row.rank - 1] ?? 0 })) };
}
