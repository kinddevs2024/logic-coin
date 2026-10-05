import { ApiError } from "./api-error.js";
import { contestCashPlan } from "./contest-cash-plan.js";
import { rankContestStandings, type ContestStandingInput } from "./contest.js";

export type ManualCashPrize = { userId: string; cashUnits: number };
export function validateManualCashPrizes(prizes: readonly ManualCashPrize[], budget: number, participants?: ReadonlySet<string>) {
  if (!Number.isSafeInteger(budget) || budget < 0) throw new ApiError(400, "invalid_prize_pool", "Некорректный фонд.");
  const seen = new Set<string>();
  let total = 0;
  for (const prize of prizes) {
    if (!/^[a-f0-9]{24}$/i.test(prize.userId) || seen.has(prize.userId.toLowerCase()) || !Number.isSafeInteger(prize.cashUnits) || prize.cashUnits < 0) {
      throw new ApiError(400, "invalid_manual_prizes", "Участники не должны повторяться, суммы должны быть неотрицательными целыми центами.");
    }
    if (participants && !participants.has(prize.userId)) throw new ApiError(400, "not_contest_participant", "Приз можно назначить только участнику этого челленджа.");
    seen.add(prize.userId.toLowerCase());
    total += prize.cashUnits;
    if (!Number.isSafeInteger(total) || total > budget) throw new ApiError(400, "prizes_exceed_pool", "Сумма назначенных призов превышает фонд челленджа.");
  }
  return total;
}

export function contestPrizePlan(standings: readonly ContestStandingInput[], settings: {
  prizePoolUnits: number; cashPrizeMinUnits: number; cashPrizeMaxUnits: number;
  manualCashPrizes?: readonly ManualCashPrize[] | null;
}) {
  const automatic = contestCashPlan(standings.length, settings.cashPrizeMinUnits, settings.cashPrizeMaxUnits, settings.prizePoolUnits);
  const ranked = rankContestStandings(standings, automatic.bands);
  if (settings.manualCashPrizes == null) return {
    ...automatic, ranked: ranked.map(row => ({ ...row, cashUnits: automatic.ladder[row.rank - 1] ?? 0 })),
  };
  // Validate the entire saved allocation, including any participant absent from a later snapshot.
  validateManualCashPrizes(settings.manualCashPrizes, settings.prizePoolUnits);
  const byUser = new Map(settings.manualCashPrizes.map(p => [p.userId, p.cashUnits]));
  const custom = ranked.map(row => {
    const cashUnits = byUser.get(row.userId) ?? 0;
    return { ...row, cashUnits, rewardType: cashUnits > 0 ? "cash" as const : row.rewardType === "cash" ? "coins" as const : row.rewardType };
  });
  const distributedUnits = custom.reduce((total, row) => total + row.cashUnits, 0);
  return {
    ranked: custom, ladder: custom.map(row => row.cashUnits), distributedUnits,
    unallocatedUnits: settings.prizePoolUnits - distributedUnits,
    bands: {
      participantCount: custom.length,
      cashWinners: custom.filter(row => row.rewardType === "cash").length,
      caseWinners: custom.filter(row => row.rewardType === "box").length,
      randomWinners: custom.filter(row => row.rewardType === "random").length,
      coinWinners: custom.filter(row => row.rewardType === "coins").length,
    },
  };
}
