import { ApiError } from "./api-error.js";
import { computeContestBands, rankContestStandings, type ContestStandingInput } from "./contest.js";

// All money is integer cents. Legacy min/max arguments are ignored: only the
// fixed pool funds cash prizes. New contests explicitly store a per-person
// cap; legacy contests without one retain their original full-pool allocation.
export function contestCashPlan(participants: number, _minimum: number, _maximum: number, budget: number, cashPrizeLimitUnits?: number | null, descendingCashPrizes = false) {
  if (!Number.isSafeInteger(participants) || participants < 0 || !Number.isSafeInteger(budget) || budget < 0) {
    throw new ApiError(400, "invalid_prize_pool", "Бюджет в центах и число участников должны быть неотрицательными целыми числами.");
  }
  const limit = cashPrizeLimitUnits ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 0) throw new ApiError(400, "invalid_prize_limit", "Некорректный лимит приза.");
  const base = computeContestBands(participants);
  const slots = Math.min(participants, Math.max(3, Math.ceil(participants / 2), limit > 0 ? Math.ceil(budget / limit) : 0));
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
  const ladder = descendingCashPrizes && limit > 0
    ? topFifthLadder(participants, budget, limit)
    : limit > 0 ? cappedLadder(weights, pool, BigInt(limit)) : weights.map(weight => Number(pool * weight / totalWeight));
  if (limit === 0) {
    let remainder = budget - ladder.reduce((sum, amount) => sum + amount, 0);
    for (let index = 0; remainder > 0; index = (index + 1) % ladder.length, remainder--) ladder[index]!++;
  }
  const positiveLadder = ladder.filter(amount => amount > 0);
  const cashWinners = positiveLadder.length;
  const caseWinners = Math.max(0, base.cashWinners + base.caseWinners - cashWinners);
  const randomWinners = Math.max(0, base.cashWinners + base.caseWinners + base.randomWinners - cashWinners - caseWinners);
  const bands = { participantCount: participants, cashWinners, caseWinners, randomWinners, coinWinners: participants - cashWinners - caseWinners - randomWinners };
  const distributedUnits = positiveLadder.reduce((sum, amount) => sum + amount, 0);
  return { bands, ladder: positiveLadder, distributedUnits, unallocatedUnits: budget - distributedUnits };
}

// Fund the top 20% (rounded up) before distributing the remaining cents.
// Equal adjacent prizes are necessary: 73 strictly descending prizes ending
// at five cents would already cost $29.93, before preserving a $1 first prize.
// A fixed pool cannot promise unlimited five-cent winners: when underfunded,
// pay only affordable ranks and never create money or exceed the first prize.
export function topFifthLadder(participants: number, budget: number, limit: number): number[] {
  if (limit === 250) return fixedPodiumLadder(participants, budget);
  if (participants === 0 || budget === 0) return [];
  const first = Math.min(limit, budget);
  const minimum = Math.min(5, first);
  const affordable = 1 + Math.floor((budget - first) / minimum);
  let winners = Math.min(participants, affordable, Math.max(1, Math.ceil(participants / 5)));
  const laterCap = Math.max(minimum, first - 1);
  // Very small cohorts may need more than 20% to distribute the full pool.
  // Keep the final prize at the minimum and first place uniquely ahead when possible.
  const capacity = (count: number) => count <= 1 ? first : first + minimum + (count - 2) * laterCap;
  while (winners < participants && winners < affordable && capacity(winners) < budget) winners++;
  if (winners === 1) return [first];
  const remainder = Math.min(budget, capacity(winners)) - first - minimum * (winners - 1);
  const middleCount = winners - 2;
  const weights = Array.from({ length: middleCount }, (_, index) => BigInt(middleCount - index) ** 3n);
  const increments = cappedLadder(weights, BigInt(remainder), BigInt(laterCap - minimum));
  return [first, ...increments.map(amount => minimum + amount), minimum];
}

// Cash recipients are capped at ceil(participants / 5). Increasing the pool
// increases prizes within this band, never the number of paid ranks beyond it.
// Reserve integer-cent minimums first; keep the fixed podium and final cent.
export function fixedPodiumLadder(participants: number, budget: number): number[] {
  const goal = Math.ceil(participants / 5);
  if (goal === 0) return [];
  const prizes = [250, 100, 50, 25].slice(0, goal);
  const remaining = budget - prizes.reduce((sum, value) => sum + value, 0);
  if (remaining < 0) throw new ApiError(400, "prize_pool_below_podium", "Фонд недостаточен для фиксированных первых мест.");
  if (goal <= 4) return prizes;
  const tailCount = Math.min(goal - 4, remaining);
  if (tailCount === 0) return prizes;
  // If a pool cannot fund even one cent per eligible rank, only affordable
  // ranks are paid. Never overdraw it or widen the top-20% band.
  const increments = steppedCentIncrements(tailCount - 1, remaining - tailCount);
  return [...prizes, ...increments.map(value => 1 + value), 1];
}

// Capped highest-averages apportionment. Allocate each extra cent to the
// largest weight/(allocated+1), with rank breaking ties. A larger budget
// cannot reduce anyone's prize. Cubic rank weights produce gradual, repeated
// cent tiers; later prizes stay <=24 cents and the last paid rank stays at 1.
function steppedCentIncrements(count: number, budget: number): number[] {
  const values = Array<number>(count).fill(0);
  const weights = values.map((_, index) => BigInt(count - index) ** 3n);
  const heap = values.map((_, index) => index);
  const ahead = (a: number, b: number) => {
    const left = weights[a]! * BigInt(values[b]! + 1);
    const right = weights[b]! * BigInt(values[a]! + 1);
    return left > right || (left === right && a < b);
  };
  let cents = Math.min(budget, count * 23);
  while (cents-- > 0 && heap.length) {
    const rank = heap[0]!;
    values[rank]!++;
    if (values[rank] === 23) {
      const last = heap.pop()!;
      if (heap.length) heap[0] = last;
    }
    let index = 0;
    while (index * 2 + 1 < heap.length) {
      let child = index * 2 + 1;
      if (child + 1 < heap.length && ahead(heap[child + 1]!, heap[child]!)) child++;
      if (ahead(heap[index]!, heap[child]!)) break;
      [heap[index], heap[child]] = [heap[child]!, heap[index]!];
      index = child;
    }
  }
  return values;
}

// Weighted water filling in integer cents. Saturated prizes are fixed before
// redistributing to the remaining ranks; a small cohort leaves a real surplus.
function cappedLadder(weights: bigint[], pool: bigint, cap: bigint) {
  const capacity = BigInt(weights.length) * cap;
  let remaining = pool < capacity ? pool : capacity;
  const prizes = weights.map(() => 0);
  let active = weights.map((_, index) => index);
  while (active.length && remaining > 0n) {
    const total = active.reduce((sum, index) => sum + weights[index]!, 0n);
    const saturated = active.filter(index => remaining * weights[index]! >= cap * total);
    if (saturated.length) {
      const locked = new Set(saturated);
      for (const index of saturated) { prizes[index] = Number(cap); remaining -= cap; }
      active = active.filter(index => !locked.has(index));
      continue;
    }
    for (const index of active) prizes[index] = Number(remaining * weights[index]! / total);
    let remainder = remaining - active.reduce((sum, index) => sum + BigInt(prizes[index]!), 0n);
    for (const index of active) { if (remainder === 0n) break; prizes[index]!++; remainder--; }
    break;
  }
  return prizes;
}

export function distributeContestPrizes(standings: readonly ContestStandingInput[], prizePoolUnits: number, cashPrizeLimitUnits?: number | null) {
  const plan = contestCashPlan(standings.length, 0, 0, prizePoolUnits, cashPrizeLimitUnits);
  return rankContestStandings(standings, plan.bands).map(row => ({ ...row, cashUnits: plan.ladder[row.rank - 1] ?? 0 }));
}
