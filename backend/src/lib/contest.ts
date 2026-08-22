export type ContestRewardType = "cash" | "case" | "coins";
export type ContestGiftKind = "extra_time" | "replay" | "coin";

const CONTEST_GIFT_ROTATION: readonly ContestGiftKind[] = ["extra_time", "replay", "coin"];

export function contestGiftKindForIndex(index: number): ContestGiftKind {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error("gift index must be a non-negative integer");
  }
  return CONTEST_GIFT_ROTATION[index % CONTEST_GIFT_ROTATION.length]!;
}

export interface ContestBands {
  participantCount: number;
  cashWinners: number;
  caseWinners: number;
  coinWinners: number;
}

export interface ContestStandingInput {
  userId: string;
  totalCoins: number;
  completedGamesCount: number;
  finishedAt: string | null;
}

export interface ContestRankedStanding extends ContestStandingInput {
  rank: number;
  rewardType: ContestRewardType;
}

function ceilStable(value: number): number {
  const nearestInteger = Math.round(value);
  return Math.abs(value - nearestInteger) < 1e-9 ? nearestInteger : Math.ceil(value);
}

export function computeContestBands(
  participantCount: number,
  cashPercent = 0.1,
  casePercent = 0.45
): ContestBands {
  if (!Number.isSafeInteger(participantCount) || participantCount < 0) {
    throw new Error("participantCount must be a non-negative integer");
  }
  if (cashPercent < 0 || casePercent < 0 || cashPercent + casePercent > 1) {
    throw new Error("contest percentages must be non-negative and total no more than one");
  }
  if (participantCount === 0) {
    return { participantCount: 0, cashWinners: 0, caseWinners: 0, coinWinners: 0 };
  }
  const cashWinners = Math.min(
    participantCount,
    Math.max(1, ceilStable(participantCount * cashPercent))
  );
  // Build adjacent percentile bands from cumulative boundaries. Independent
  // rounding would over-allocate the middle band for small cohorts.
  const rewardedThrough = Math.min(
    participantCount,
    ceilStable(participantCount * (cashPercent + casePercent))
  );
  const caseWinners = Math.max(0, rewardedThrough - cashWinners);
  return {
    participantCount,
    cashWinners,
    caseWinners,
    coinWinners: participantCount - cashWinners - caseWinners
  };
}

export function interpolateCashPrize(
  rank: number,
  cashWinners: number,
  minUnits: number,
  maxUnits: number
): number {
  if (!Number.isSafeInteger(rank) || !Number.isSafeInteger(cashWinners) || rank < 1 || cashWinners < 1) {
    throw new Error("rank and cashWinners must be positive integers");
  }
  if (!Number.isSafeInteger(minUnits) || !Number.isSafeInteger(maxUnits) || minUnits < 0 || maxUnits < minUnits) {
    throw new Error("cash prize bounds are invalid");
  }
  if (cashWinners === 1) {
    return maxUnits;
  }
  const clampedRank = Math.min(rank, cashWinners);
  return Math.round(
    maxUnits - ((maxUnits - minUnits) * (clampedRank - 1)) / (cashWinners - 1)
  );
}

export function buildCashPrizeLadder(
  cashWinners: number,
  minUnits: number,
  maxUnits: number
): number[] {
  return Array.from({ length: cashWinners }, (_, index) =>
    interpolateCashPrize(index + 1, cashWinners, minUnits, maxUnits)
  );
}

export function rankContestStandings(
  standings: readonly ContestStandingInput[],
  bands: ContestBands
): ContestRankedStanding[] {
  const sorted = [...standings].sort((first, second) => {
    if (second.totalCoins !== first.totalCoins) return second.totalCoins - first.totalCoins;
    if (second.completedGamesCount !== first.completedGamesCount) {
      return second.completedGamesCount - first.completedGamesCount;
    }
    const firstTime = first.finishedAt ?? "9999";
    const secondTime = second.finishedAt ?? "9999";
    if (firstTime !== secondTime) return firstTime < secondTime ? -1 : 1;
    return first.userId.localeCompare(second.userId);
  });

  return sorted.map((standing, index) => {
    const rank = index + 1;
    const rewardType: ContestRewardType =
      rank <= bands.cashWinners
        ? "cash"
        : rank <= bands.cashWinners + bands.caseWinners
          ? "case"
          : "coins";
    return { ...standing, rank, rewardType };
  });
}
