import { ApiError } from "./api-error.js";
import { computeContestBands, rankContestStandings, type ContestStandingInput } from "./contest.js";

// All money is integer cents. Legacy min/max arguments are ignored: only the
// fixed pool funds cash prizes. The payout template is normalized for small
// cohorts, so the full pool is shared among eligible winners in rank order.
export function contestCashPlan(participants: number, _minimum: number, _maximum: number, budget: number) {
  if (!Number.isSafeInteger(participants) || participants < 0 || !Number.isSafeInteger(budget) || budget < 0) {
    throw new ApiError(400, "invalid_prize_pool", "Бюджет в центах и число участников должны быть неотрицательными целыми числами.");
  }
  const base = computeContestBands(participants);
  const slots = Math.min(participants, Math.max(3, Math.ceil(participants / 2)));
  if (slots === 0) {
    return { bands: { participantCount: participants, cashWinners: 0, caseWinners: 0, randomWinners: 0, coinWinners: participants }, ladder: [], distributedUnits: 0, unallocatedUnits: budget };
  }
  const pool = BigInt(budget);
  const tailCount = Math.max(0, slots - 3);
  // Scale podium weights when a tail exists. This preserves its 25/15/10
  // relationship while ensuring every later rank receives strictly less.
  const podiumScale = BigInt(tailCount + 1);
  const weights = [25n * podiumScale, 15n * podiumScale, 10n * podiumScale].slice(0, slots);
  if (tailCount > 0) {
    // Small descending weights keep all later prizes below third place.
    for (let weight = tailCount; weight > 0; weight--) weights.push(BigInt(weight));
  }
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0n);
  const ladder = weights.map(weight => Number(pool * weight / totalWeight));
  let remainder = budget - ladder.reduce((sum, amount) => sum + amount, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % ladder.length, remainder--) ladder[index]!++;
  const positiveLadder = ladder.filter(amount => amount > 0);
  const cashWinners = positiveLadder.length;
  const caseWinners = Math.max(0, base.cashWinners + base.caseWinners - cashWinners);
  const randomWinners = Math.max(0, base.cashWinners + base.caseWinners + base.randomWinners - cashWinners - caseWinners);
  const bands = { participantCount: participants, cashWinners, caseWinners, randomWinners, coinWinners: participants - cashWinners - caseWinners - randomWinners };
  const distributedUnits = positiveLadder.reduce((sum, amount) => sum + amount, 0);
  return { bands, ladder: positiveLadder, distributedUnits, unallocatedUnits: budget - distributedUnits };
}

export function distributeContestPrizes(standings: readonly ContestStandingInput[], prizePoolUnits: number) {
  const plan = contestCashPlan(standings.length, 0, 0, prizePoolUnits);
  return rankContestStandings(standings, plan.bands).map(row => ({ ...row, cashUnits: plan.ladder[row.rank - 1] ?? 0 }));
}
