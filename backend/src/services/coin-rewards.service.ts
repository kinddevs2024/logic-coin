import { Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { addDays, currentMonthBounds, currentWeekBounds, localDayKey } from "../lib/date.js";
import { nextLoginSlot, periodRewardEligible } from "../lib/coin-reward-policy.js";
import { CoinRewardLogin } from "../models/CoinRewardLogin.js";
import { CoinLedgerEntry } from "../models/CoinLedgerEntry.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { creditCoins, getCoinBalance } from "./coin.service.js";
const timezone = "Asia/Tashkent";
const ledgerType = "attendance_coin_reward" as const;
export async function recordCoinRewardLogin(userId: Types.ObjectId, now = new Date()) {
  const today = localDayKey(now, timezone);
  const id = `${userId}:${today}`;
  const existing = await CoinRewardLogin.findById(id).lean();
  if (existing) return existing;
  const previous = await CoinRewardLogin.findById(`${userId}:${addDays(today, -1)}`).lean();
  try {
    return await CoinRewardLogin.findOneAndUpdate({ _id: id }, { $setOnInsert: { userId, dayKey: today, slot: nextLoginSlot(previous, today) } }, { upsert: true, new: true }).lean();
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    return CoinRewardLogin.findById(id).lean();
  }
}
export async function coinRewardsOffer(userId: Types.ObjectId, now = new Date()) {
  const login = await recordCoinRewardLogin(userId, now);
  if (!login) throw new ApiError(500, "reward_login_failed", "Не удалось определить день входа");
  const today = login.dayKey;
  const week = currentWeekBounds(today), month = currentMonthBounds(today);
  const previousWeek = currentWeekBounds(addDays(week.from, -1));
  const previousMonth = currentMonthBounds(addDays(month.from, -1));
  const earliest = previousWeek.from < previousMonth.from ? previousWeek.from : previousMonth.from;
  const [first, attempts, claims] = await Promise.all([
    CoinRewardLogin.findOne({ userId }).sort({ dayKey: 1 }).lean(),
    ChallengeAttempt.aggregate<{ _id: string }>([
      { $match: { userId, status: "completed", completedAt: { $gte: new Date(`${earliest}T00:00:00+05:00`), $lte: now } } },
      { $group: { _id: { $dateToString: { date: "$completedAt", format: "%Y-%m-%d", timezone } } } },
    ]),
    CoinLedgerEntry.find({ userId, type: ledgerType, sourceId: /^attendance:/ }).select("sourceId").lean(),
  ]);
  const claimed = new Set(claims.map(entry => entry.sourceId));
  const activeDays = attempts.map(attempt => attempt._id);
  const cycleStart = addDays(today, 1 - login.slot);
  const daily = Array.from({ length: 7 }, (_, index) => {
    const dayKey = addDays(cycleStart, index), sourceId = `attendance:daily:${dayKey}`;
    const status = claimed.has(sourceId) ? "claimed" : dayKey === today ? "available" : dayKey < today ? "missed" : "locked";
    return { day: index + 1, dayKey, coins: 100, status };
  });
  function periodOffer(kind: "week" | "month", current: typeof week, previous: typeof week) {
    const previousPolicy = periodRewardEligible(kind, previous, today, first?.dayKey ?? today, activeDays);
    const previousSource = `attendance:${kind}:${previous.from}`;
    const period = previousPolicy.eligible && !claimed.has(previousSource) ? previous : current;
    const policy = periodRewardEligible(kind, period, today, first?.dayKey ?? today, activeDays);
    const sourceId = `attendance:${kind}:${period.from}`;
    return { kind, from: period.from, to: period.to, coins: kind === "week" ? 250 : 500, activeDays: policy.count, totalDays: kind === "week" ? 7 : Number(period.to.slice(8)), status: claimed.has(sourceId) ? "claimed" : policy.eligible ? "available" : "locked" };
  }
  return { dayKey: today, daily, weekly: periodOffer("week", week, previousWeek), monthly: periodOffer("month", month, previousMonth) };
}
export async function claimCoinReward(userId: Types.ObjectId, kind: "daily" | "week" | "month") {
  const offer = await coinRewardsOffer(userId);
  const reward = kind === "daily" ? offer.daily.find(day => day.dayKey === offer.dayKey)! : kind === "week" ? offer.weekly : offer.monthly;
  if (reward.status !== "available") throw new ApiError(409, "coin_reward_unavailable", "Подарок уже получен или пока недоступен");
  const periodKey = kind === "daily" ? offer.dayKey : (kind === "week" ? offer.weekly.from : offer.monthly.from);
  const result = await creditCoins({ userId, amount: reward.coins, type: ledgerType, sourceId: `attendance:${kind}:${periodKey}`, description: `${kind} activity gift`, metadata: { rewardKind: kind, periodKey } });
  return { credited: result.idempotentReplay ? 0 : reward.coins, coins: await getCoinBalance(userId) };
}
