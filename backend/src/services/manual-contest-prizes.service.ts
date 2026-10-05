import { ApiError } from "../lib/api-error.js";
import { contestPrizePlan, validateManualCashPrizes, type ManualCashPrize } from "../lib/manual-contest-prizes.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { DailyContestResult } from "../models/DailyContestResult.js";
import { User } from "../models/User.js";
import { collectContestStandings } from "./contest.service.js";
import { invalidateContestProgress } from "./contest-progress.service.js";
import { broadcastDailyChallengeUpdate } from "./live-updates.service.js";

export async function getManualContestPrizes(dayKey: string) {
  const set = await DailyChallengeSet.findOne({ dayKey }).lean();
  if (!set) throw new ApiError(404, "daily_challenge_not_found", "Сначала сохраните челлендж.");
  const standings = await collectContestStandings(dayKey);
  const plan = contestPrizePlan(standings, set);
  const finalResults = set.status === "settled" ? await DailyContestResult.find({ dayKey }).lean() : [];
  const rows = set.status === "settled" ? finalResults.map(row => ({ userId: String(row.userId), rank: row.rank, totalCoins: row.totalCoins, cashUnits: row.cashUnits ?? 0 })) : plan.ranked;
  const users = await User.find({ _id: { $in: rows.map(row => row.userId) } }).select("name").lean();
  const names = new Map(users.map(user => [String(user._id), user.name]));
  const allocatedUnits = rows.reduce((sum, row) => sum + row.cashUnits, 0);
  return {
    dayKey, mode: set.manualCashPrizes == null ? "automatic" as const : "manual" as const,
    revision: set.manualPrizeRevision ?? 0, locked: set.status === "settled" || Boolean(set.prizesLocked),
    prizePoolUnits: set.prizePoolUnits, allocatedUnits, remainingUnits: set.prizePoolUnits - allocatedUnits,
    participants: rows.sort((a, b) => a.rank - b.rank).map(row => ({ userId: row.userId, name: names.get(row.userId) ?? "Участник", rank: row.rank, totalCoins: row.totalCoins, cashUnits: row.cashUnits })),
  };
}

export async function saveManualContestPrizes(input: {
  dayKey: string; revision: number; mode: "automatic" | "manual";
  prizes: ManualCashPrize[]; adminSubject: string;
}) {
  const set = await DailyChallengeSet.findOne({ dayKey: input.dayKey }).lean();
  if (!set) throw new ApiError(404, "daily_challenge_not_found", "Челлендж не найден.");
  if (set.status === "settled" || set.prizesLocked) throw new ApiError(409, "prizes_locked", "Итоги уже рассчитываются или рассчитаны. Изменение призов запрещено.");
  if ((set.manualPrizeRevision ?? 0) !== input.revision) throw new ApiError(409, "prizes_changed", "Призы уже изменены другим администратором. Обновите список.");
  if (input.mode === "automatic" && input.prizes.length) throw new ApiError(400, "invalid_manual_prizes", "Для автоматического режима список должен быть пустым.");
  const participants = new Set((await collectContestStandings(input.dayKey)).map(row => row.userId));
  validateManualCashPrizes(input.prizes, set.prizePoolUnits, participants);
  const updated = await DailyChallengeSet.findOneAndUpdate({
    _id: set._id, updatedAt: set.updatedAt, status: { $ne: "settled" }, prizesLocked: { $ne: true },
    ...(input.revision === 0 ? { $or: [{ manualPrizeRevision: 0 }, { manualPrizeRevision: { $exists: false } }] } : { manualPrizeRevision: input.revision }),
  }, {
    $set: { manualCashPrizes: input.mode === "manual" ? input.prizes : null, manualPrizesUpdatedBy: input.adminSubject, manualPrizesUpdatedAt: new Date() },
    $inc: { manualPrizeRevision: 1 },
  }, { new: true, runValidators: true });
  if (!updated) throw new ApiError(409, "prizes_changed", "Челлендж изменился или начат расчёт. Обновите список.");
  invalidateContestProgress(input.dayKey);
  broadcastDailyChallengeUpdate(input.dayKey);
  return getManualContestPrizes(input.dayKey);
}
