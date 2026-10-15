import type { ClientSession, Types } from "mongoose";
import { env } from "../config/env.js";
import { localDayKey } from "../lib/date.js";
import { ApiError } from "../lib/api-error.js";
import { NAVIGATION_CHALLENGE_REWARD } from "../lib/challenge-ad-reward.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { User } from "../models/User.js";
import { bonusDay, DAILY_BONUS_LIMIT, DAILY_BONUS_DELAYS_MS, nextBonusDeadline } from "../lib/daily-bonus-schedule.js";

export const CHALLENGE_AD_COOLDOWN_MS = 5 * 60 * 1000;

export async function getChallengeAdOffer(userId: Types.ObjectId, now = new Date(), session: ClientSession | null = null) {
  const { dayKey: rewardDayKey } = bonusDay(now);
  await User.updateOne({ _id: userId, challengeAdRewardDay: { $ne: rewardDayKey } }, { $set: { challengeAdRewardDay: rewardDayKey, challengeAdDailyCount: 0, challengeAdAvailableAt: nextBonusDeadline(now, 0) } }, session ? { session } : {});
  const [set, user] = await Promise.all([
    DailyChallengeSet.findOne({ dayKey: { $lte: localDayKey(now, env.DEFAULT_TIMEZONE) }, status: { $in: ["published", "settled"] } }).sort({ dayKey: -1 }).session(session),
    User.findById(userId).select("challengeAdAvailableAt challengeAdRewardDay challengeAdDailyCount").session(session),
  ]);
  if (!user) throw new ApiError(404, "user_not_found", "User not found");
  const completed = set ? await ChallengeAttempt.distinct("gameId", { userId, dailyChallengeSetId: set._id, gameId: { $in: set.gameIds }, mode: "challenge", status: "completed" }).session(session) : [];
  const claimedCount = user.challengeAdDailyCount ?? 0;
  const eligible = claimedCount < DAILY_BONUS_LIMIT && Boolean(set && set.gameIds.length > 0 && completed.length === set.gameIds.length);
  const availableAt = user.challengeAdAvailableAt ?? now;
  return { eligible, available: eligible && availableAt <= now, challengeSetId: set ? String(set._id) : null,
    dayKey: set?.dayKey ?? null, rewardCoins: NAVIGATION_CHALLENGE_REWARD, cooldownSeconds: (DAILY_BONUS_DELAYS_MS[claimedCount] ?? 0) / 1000,
    claimedCount, rewardDayKey, dailyLimit: DAILY_BONUS_LIMIT,
    availableAt: availableAt.toISOString(), serverNow: now.toISOString() };
}

export async function requireChallengeAdOffer(userId: Types.ObjectId, now = new Date(), session: ClientSession | null = null, expectedSetId?: string) {
  const offer = await getChallengeAdOffer(userId, now, session);
  if (!offer.eligible || (expectedSetId && expectedSetId !== offer.challengeSetId)) throw new ApiError(409, "challenge_ad_not_eligible", "Сначала завершите все игры текущего челленджа.");
  if (!offer.available) throw new ApiError(429, "challenge_ad_cooldown", "Следующая награда ещё не доступна.", { availableAt: offer.availableAt });
  return offer;
}
