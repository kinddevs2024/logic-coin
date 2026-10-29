import type { ClientSession, Types } from "mongoose";
import { env } from "../config/env.js";
import { localDayKey } from "../lib/date.js";
import { ApiError } from "../lib/api-error.js";
import { NAVIGATION_CHALLENGE_REWARD } from "../lib/challenge-ad-reward.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { User } from "../models/User.js";
import { bonusDay } from "../lib/daily-bonus-schedule.js";
import { CHALLENGE_AD_DAILY_LIMIT, CHALLENGE_AD_DELAYS_MS, nextChallengeAdDeadline } from "../lib/challenge-ad-schedule.js";

export const CHALLENGE_AD_COOLDOWN_MS = 5 * 60 * 1000;

export async function getChallengeAdOffer(userId: Types.ObjectId, now = new Date(), session: ClientSession | null = null) {
  const { dayKey: rewardDayKey, resetsAt } = bonusDay(now);
  await User.updateOne({ _id: userId, challengeAdRewardDay: { $ne: rewardDayKey } }, { $set: { challengeAdRewardDay: rewardDayKey, challengeAdDailyCount: 0, challengeAdAvailableAt: nextChallengeAdDeadline(now, 0) } }, session ? { session } : {});
  const [set, user] = await Promise.all([
    DailyChallengeSet.findOne({ dayKey: localDayKey(now, env.DEFAULT_TIMEZONE), status: "published", $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }).sort({ dayKey: -1 }).session(session),
    User.findById(userId).select("challengeAdAvailableAt challengeAdRewardDay challengeAdDailyCount").session(session),
  ]);
  if (!user) throw new ApiError(404, "user_not_found", "User not found");
  const claimedCount = user.challengeAdDailyCount ?? 0;
  const eligible = claimedCount < CHALLENGE_AD_DAILY_LIMIT && Boolean(set && set.gameIds.length > 0);
  const availableAt = user.challengeAdAvailableAt ?? now;
  return { eligible, available: eligible && availableAt <= now, challengeSetId: set ? String(set._id) : null,
    dayKey: set?.dayKey ?? null, rewardCoins: NAVIGATION_CHALLENGE_REWARD, cooldownSeconds: (CHALLENGE_AD_DELAYS_MS[claimedCount] ?? 0) / 1000,
    claimedCount, rewardDayKey, resetsAt: resetsAt.toISOString(), dailyLimit: CHALLENGE_AD_DAILY_LIMIT,
    availableAt: availableAt.toISOString(), serverNow: now.toISOString() };
}

export async function requireChallengeAdOffer(userId: Types.ObjectId, now = new Date(), session: ClientSession | null = null, expectedSetId?: string) {
  const offer = await getChallengeAdOffer(userId, now, session);
  if (!offer.eligible || (expectedSetId && expectedSetId !== offer.challengeSetId)) throw new ApiError(409, "challenge_ad_not_eligible", "Сейчас нет активного челленджа для рекламной награды.");
  if (!offer.available) throw new ApiError(429, "challenge_ad_cooldown", "Следующая награда ещё не доступна.", { availableAt: offer.availableAt });
  return offer;
}

/** Declining spends an offer, not coins. Compare-and-set makes retries idempotent. */
export async function declineChallengeAdOffer(userId: Types.ObjectId, expected: { rewardDayKey: string; claimedCount: number }, now = new Date()) {
  const offer = await getChallengeAdOffer(userId, now);
  if (offer.rewardDayKey !== expected.rewardDayKey || offer.claimedCount !== expected.claimedCount) return offer;
  if (!offer.available) throw new ApiError(409, "offer_not_available", "Offer is not available");
  await User.updateOne({ _id: userId, challengeAdRewardDay: expected.rewardDayKey, challengeAdDailyCount: expected.claimedCount, challengeAdAvailableAt: { $lte: now } },
    { $inc: { challengeAdDailyCount: 1 }, $set: { challengeAdAvailableAt: nextChallengeAdDeadline(now, expected.claimedCount + 1) } });
  return getChallengeAdOffer(userId, now);
}
