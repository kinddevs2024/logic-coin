import { randomUUID } from "node:crypto";
import mongoose, { type ClientSession, type Types } from "mongoose";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { opaqueTokenMatches } from "../lib/crypto.js";
import { HomeGiftState } from "../models/HomeGiftState.js";
import { User } from "../models/User.js";
import { TelegramLoginChallenge } from "../models/TelegramLoginChallenge.js";
import { RewardedAdSession } from "../models/RewardedAdSession.js";
import { ChallengeAdReward } from "../models/ChallengeAdReward.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { challengeDayKey } from "./daily-challenge.service.js";
import { invalidateContestProgress } from "./contest-progress.service.js";
import { createTelegramLogin } from "./telegram-auth.service.js";
import { bonusDay, DAILY_BONUS_LIMIT, nextBonusDeadline } from "../lib/daily-bonus-schedule.js";

export const HOME_GIFT_CHANNEL = "@logic_coin_global";
export const HOME_GIFT_INSTAGRAM_URL = "https://www.instagram.com/logic_coin/";
export const HOME_GIFT_COOLDOWN_MS = 120_000;
const CYCLE_TTL_MS = 10 * 60_000;

export function isTelegramMember(member: { status?: string; is_member?: boolean }): boolean {
  return ["member", "administrator", "creator"].includes(member.status ?? "") || (member.status === "restricted" && member.is_member === true);
}
async function requireCurrentChallenge(dayKey = challengeDayKey(), session: ClientSession | null = null) {
  const now = new Date();
  const set = await DailyChallengeSet.findOne({ dayKey, status: "published", $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }).session(session);
  if (!set) throw new ApiError(409, "home_gift_challenge_unavailable", "Сейчас нет активного челленджа для подарка.");
  return set;
}
async function stateFor(userId: Types.ObjectId) {
  const now = new Date(); const { dayKey } = bonusDay(now);
  await HomeGiftState.findOneAndUpdate({ userId }, { $setOnInsert: { availableAt: nextBonusDeadline(now, 0), rewardDayKey: dayKey, dailyClaimCount: 0 } }, { upsert: true, new: true });
  await HomeGiftState.updateOne({ userId, rewardDayKey: { $ne: dayKey } }, { $set: { rewardDayKey: dayKey, dailyClaimCount: 0, availableAt: nextBonusDeadline(now, 0) }, $unset: { cycleId: 1, cycleDayKey: 1, cycleExpiresAt: 1 } });
  return HomeGiftState.findOne({ userId });
}
export async function getHomeGiftOffer(userId: Types.ObjectId, includeInstagram = false) {
  const now = new Date();
  const [state, user, set] = await Promise.all([
    stateFor(userId), User.findById(userId).select("providers.telegramSub"),
    DailyChallengeSet.findOne({ dayKey: challengeDayKey(), status: "published", $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }).select("_id"),
  ]);
  if (!state || !user) throw new ApiError(404, "user_not_found", "User not found");
  const completedAds = state.cycleId && state.cycleExpiresAt && state.cycleExpiresAt > now
    ? await RewardedAdSession.countDocuments({ userId, placement: "home-gift", homeGiftCycleId: state.cycleId, status: "completed", expiresAt: { $gt: now } }) : 0;
  const telegramDone = Boolean(state.telegramRewardedAt || state.telegramSkippedAt);
  const kind = includeInstagram && !state.instagramRewardedAt ? "instagram" : !telegramDone ? "telegram" : "ads";
  return { kind, rewardCoins: kind === "instagram" ? 100 : kind === "telegram" ? 50 : 75, instagramUrl: HOME_GIFT_INSTAGRAM_URL,
    eligible: Boolean(set), available: Boolean(set) && state.dailyClaimCount < DAILY_BONUS_LIMIT && state.availableAt <= now, availableAt: state.availableAt.toISOString(), serverNow: now.toISOString(),
    dailyClaimCount: state.dailyClaimCount, dailyLimit: DAILY_BONUS_LIMIT, exhausted: state.dailyClaimCount >= DAILY_BONUS_LIMIT,
    telegramLinked: Boolean(user.providers.telegramSub), channelUrl: "https://t.me/logic_coin_global", completedAds: Math.min(2, completedAds),
  };
}

// A failed social task is resolved without a reward. Repeated requests cannot
// advance the daily schedule again or turn a skipped subscription into a claim.
export async function skipHomeGiftTelegram(userId: Types.ObjectId) {
  const state = await stateFor(userId); const now = new Date();
  if (!state || state.telegramRewardedAt || state.telegramSkippedAt) return { skipped: false };
  if (state.availableAt > now || state.dailyClaimCount >= DAILY_BONUS_LIMIT) throw new ApiError(409, "home_gift_unavailable", "Подарок ещё не доступен.");
  const updated = await HomeGiftState.findOneAndUpdate({ userId, telegramRewardedAt: { $exists: false }, telegramSkippedAt: { $exists: false }, rewardDayKey: bonusDay(now).dayKey, dailyClaimCount: state.dailyClaimCount, availableAt: { $lte: now } },
    { $set: { telegramSkippedAt: now, availableAt: nextBonusDeadline(now, state.dailyClaimCount + 1) }, $inc: { dailyClaimCount: 1 } }, { new: true });
  return { skipped: Boolean(updated) };
}

export async function startHomeGiftInstagram(userId: Types.ObjectId) {
  await requireCurrentChallenge();
  const state = await stateFor(userId); const now = new Date();
  if (!state || state.instagramRewardedAt || state.availableAt > now || state.dailyClaimCount >= DAILY_BONUS_LIMIT) throw new ApiError(409, "home_gift_unavailable", "Задание сейчас недоступно.");
  const visitId = randomUUID();
  const updated = await HomeGiftState.findOneAndUpdate({ userId, instagramRewardedAt: { $exists: false }, availableAt: { $lte: now }, rewardDayKey: bonusDay(now).dayKey, dailyClaimCount: state.dailyClaimCount }, { $set: { instagramVisitId: visitId, instagramOpenedAt: now } }, { new: true });
  if (!updated) throw new ApiError(409, "home_gift_changed", "Откройте подарок заново.");
  return { visitId, url: HOME_GIFT_INSTAGRAM_URL };
}

export async function claimHomeGiftInstagram(userId: Types.ObjectId, visitId: string) {
  const session = await mongoose.startSession(); let credited = 0; let rewardDay = "";
  try { await session.withTransaction(async () => {
    credited = 0;
    const now = new Date();
    const state = await HomeGiftState.findOne({ userId }).session(session);
    if (state?.instagramRewardedAt) return;
    if (!state || state.instagramVisitId !== visitId || !state.instagramOpenedAt || state.instagramOpenedAt.getTime() > now.getTime() - 2000
      || state.instagramOpenedAt.getTime() < now.getTime() - CYCLE_TTL_MS || state.availableAt > now
      || state.rewardDayKey !== bonusDay(now).dayKey || state.dailyClaimCount >= DAILY_BONUS_LIMIT) throw new ApiError(409, "instagram_visit_required", "Откройте Instagram и вернитесь к заданию.");
    const set = await requireCurrentChallenge(undefined, session); rewardDay = set.dayKey;
    const updated = await HomeGiftState.findOneAndUpdate({ userId, instagramVisitId: visitId, instagramRewardedAt: { $exists: false }, dailyClaimCount: state.dailyClaimCount, rewardDayKey: bonusDay(now).dayKey },
      { $set: { instagramRewardedAt: now, availableAt: nextBonusDeadline(now, state.dailyClaimCount + 1) }, $inc: { dailyClaimCount: 1 }, $unset: { instagramVisitId: 1, instagramOpenedAt: 1 } }, { new: true, session });
    if (!updated) return;
    await ChallengeAdReward.create([{ userId, sessionId: `home-gift:instagram:${userId}`, dayKey: set.dayKey, amount: 100 }], { session });
    credited = 100;
  }); } finally { await session.endSession(); }
  if (credited) invalidateContestProgress(rewardDay);
  return { credited, alreadyClaimed: credited === 0 };
}
export async function startHomeGiftTelegramLink(userId: Types.ObjectId) {
  const user = await User.findById(userId).select("providers.telegramSub");
  if (!user) throw new ApiError(404, "user_not_found", "User not found");
  if (user.providers.telegramSub) throw new ApiError(409, "telegram_already_linked", "Telegram уже привязан.");
  return createTelegramLogin(undefined, undefined, "app", userId);
}
export async function finishHomeGiftTelegramLink(userId: Types.ObjectId, flowId: string, pollToken: string) {
  const flow = await TelegramLoginChallenge.findOne({ flowId, linkUserId: userId, expiresAt: { $gt: new Date() } }).select("+pollTokenHash");
  if (!flow?.pollTokenHash || !opaqueTokenMatches(pollToken, flow.pollTokenHash)) throw new ApiError(400, "invalid_telegram_flow", "Привязка Telegram истекла. Повторите.");
  if (!flow.confirmedAt || !flow.telegramUser) return { linked: false };
  const telegramSub = flow.telegramUser.id;
  if (await User.exists({ "providers.telegramSub": telegramSub, _id: { $ne: userId } })) throw new ApiError(409, "telegram_linked_elsewhere", "Этот Telegram уже связан с другим аккаунтом Logic Coin.");
  try {
    const user = await User.findOneAndUpdate({ _id: userId, $or: [{ "providers.telegramSub": { $exists: false } }, { "providers.telegramSub": telegramSub }] }, { $set: { "providers.telegramSub": telegramSub } }, { new: true });
    if (!user) throw new ApiError(409, "telegram_link_conflict", "У аккаунта уже есть другая привязка Telegram.");
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new ApiError(409, "telegram_linked_elsewhere", "Этот Telegram уже связан с другим аккаунтом.");
    throw error;
  }
  return { linked: true };
}
async function verifyMembership(telegramId: string) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new ApiError(503, "telegram_unavailable", "Проверка Telegram временно недоступна.");
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getChatMember`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: HOME_GIFT_CHANNEL, user_id: telegramId }), signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json() as { ok?: boolean; result?: { status?: string; is_member?: boolean } };
    if (!response.ok || !body.ok || !body.result) throw new ApiError(503, "telegram_unavailable", "Не удалось проверить подписку. Повторите позже.");
    return isTelegramMember(body.result);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "telegram_unavailable", "Не удалось проверить подписку. Повторите позже.");
  }
}
export async function claimHomeGiftTelegram(userId: Types.ObjectId) {
  const user = await User.findById(userId).select("providers.telegramSub");
  const telegramId = user?.providers.telegramSub;
  if (!telegramId) throw new ApiError(409, "telegram_link_required", "Сначала привяжите Telegram к своему аккаунту.");
  const state = await stateFor(userId);
  if (state?.telegramRewardedAt) return { credited: 0, alreadyClaimed: true };
  if (state?.telegramSkippedAt) throw new ApiError(409, "telegram_task_skipped", "Это задание пропущено без награды.");
  if (!state || state.availableAt > new Date()) throw new ApiError(429, "home_gift_cooldown", "Подарок ещё не доступен.");
  if (state.dailyClaimCount >= DAILY_BONUS_LIMIT) throw new ApiError(429, "home_gift_daily_limit", "Все подарки на сегодня получены.");
  if (!await verifyMembership(telegramId)) throw new ApiError(409, "telegram_subscription_required", "Подпишитесь на канал и нажмите «Проверить».");
  const session = await mongoose.startSession(); let credited = 0; let rewardDay = "";
  try { await session.withTransaction(async () => {
    const set = await requireCurrentChallenge(undefined, session); rewardDay = set.dayKey;
    const now = new Date();
    const claimed = await HomeGiftState.findOneAndUpdate({ userId, telegramRewardedAt: { $exists: false }, telegramSkippedAt: { $exists: false }, availableAt: { $lte: now }, rewardDayKey: bonusDay(now).dayKey, dailyClaimCount: state.dailyClaimCount },
      { $set: { telegramRewardedAt: now, availableAt: nextBonusDeadline(now, state.dailyClaimCount + 1) }, $inc: { dailyClaimCount: 1 } }, { new: true, session });
    if (!claimed) { credited = 0; return; }
    await ChallengeAdReward.create([{ userId, sessionId: `home-gift:telegram:${telegramId}`, dayKey: set.dayKey, amount: 50 }], { session }); credited = 50;
  }); } finally { await session.endSession(); }
  if (credited) invalidateContestProgress(rewardDay);
  return { credited, alreadyClaimed: credited === 0 };
}
export async function startHomeGiftAds(userId: Types.ObjectId) {
  const state = await stateFor(userId); const now = new Date(); const set = await requireCurrentChallenge();
  if (!state || !(state.telegramRewardedAt || state.telegramSkippedAt)) throw new ApiError(409, "home_gift_telegram_first", "Сначала завершите задание Telegram.");
  if (state.dailyClaimCount >= DAILY_BONUS_LIMIT) throw new ApiError(429, "home_gift_daily_limit", "Все подарки на сегодня получены.");
  if (state.availableAt > now) throw new ApiError(429, "home_gift_cooldown", "Следующий подарок ещё не доступен.");
  let active = await HomeGiftState.findOneAndUpdate({ userId, $and: [{ $or: [{ telegramRewardedAt: { $exists: true } }, { telegramSkippedAt: { $exists: true } }] }], availableAt: { $lte: now },
    $or: [{ cycleId: { $exists: false } }, { cycleExpiresAt: { $lte: now } }, { cycleDayKey: { $ne: set.dayKey } }] },
    { $set: { cycleId: randomUUID(), cycleDayKey: set.dayKey, cycleExpiresAt: new Date(now.getTime() + CYCLE_TTL_MS) } }, { new: true });
  active ??= await HomeGiftState.findOne({ userId, cycleDayKey: set.dayKey, cycleExpiresAt: { $gt: now }, availableAt: { $lte: now } });
  if (!active?.cycleId) throw new ApiError(409, "home_gift_cycle_unavailable", "Обновите задание.");
  const completedAds = await RewardedAdSession.countDocuments({ userId, placement: "home-gift", homeGiftCycleId: active.cycleId, status: "completed", expiresAt: { $gt: now } });
  return { cycleId: active.cycleId, completedAds: Math.min(2, completedAds) };
}
export async function requireHomeGiftAdFlow(userId: Types.ObjectId) {
  const state = await HomeGiftState.findOne({ userId, $or: [{ telegramRewardedAt: { $exists: true } }, { telegramSkippedAt: { $exists: true } }], cycleId: { $exists: true }, cycleExpiresAt: { $gt: new Date() }, availableAt: { $lte: new Date() } });
  if (!state?.cycleId || !state.cycleDayKey || state.rewardDayKey !== bonusDay(new Date()).dayKey || state.dailyClaimCount >= DAILY_BONUS_LIMIT) throw new ApiError(409, "home_gift_cycle_unavailable", "Сначала откройте задание подарка.");
  await requireCurrentChallenge(state.cycleDayKey); return state;
}
export async function claimHomeGiftAds(userId: Types.ObjectId, cycleId: string) {
  const session = await mongoose.startSession(); let credited = 0; let rewardDay = "";
  try { await session.withTransaction(async () => {
    const state = await HomeGiftState.findOne({ userId }).session(session);
    if (state?.lastClaimedCycle === cycleId) { credited = 0; return; }
    if (!state || state.cycleId !== cycleId || !state.cycleExpiresAt || state.cycleExpiresAt < new Date() || state.availableAt > new Date()) throw new ApiError(409, "home_gift_cycle_unavailable", "Задание истекло. Откройте подарок заново.");
    if (state.rewardDayKey !== bonusDay(new Date()).dayKey || state.dailyClaimCount >= DAILY_BONUS_LIMIT) throw new ApiError(409, "home_gift_daily_limit", "Подарки этого дня закончились. Откройте задание заново.");
    const set = await requireCurrentChallenge(state.cycleDayKey ?? undefined, session); rewardDay = set.dayKey;
    const ads = await RewardedAdSession.find({ userId, placement: "home-gift", homeGiftCycleId: cycleId, status: "completed", expiresAt: { $gt: new Date() } }).sort({ completedAt: 1 }).limit(2).session(session);
    if (ads.length !== 2) throw new ApiError(409, "home_gift_two_ads_required", "Нужно полностью посмотреть две рекламы.");
    const consumed = await RewardedAdSession.updateMany({ _id: { $in: ads.map(ad => ad._id) }, status: "completed" }, { $set: { status: "claimed", claimedAt: new Date() } }, { session });
    if (consumed.modifiedCount !== 2) throw new ApiError(409, "home_gift_ad_already_used", "Эти просмотры уже использованы.");
    await ChallengeAdReward.create([{ userId, sessionId: `home-gift:ads:${cycleId}`, dayKey: set.dayKey, amount: 75 }], { session });
    state.dailyClaimCount += 1;
    state.lastClaimedCycle = cycleId; state.availableAt = nextBonusDeadline(new Date(), state.dailyClaimCount); state.set("cycleId", undefined); state.set("cycleDayKey", undefined); state.set("cycleExpiresAt", undefined);
    await state.save({ session }); credited = 75;
  }); } finally { await session.endSession(); }
  if (credited) invalidateContestProgress(rewardDay);
  return { credited, alreadyClaimed: credited === 0 };
}
