import {
  createDecipheriv,
  createHash,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import { parse as parseQueryString } from "node:querystring";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { Game } from "../models/Game.js";
import { ChallengeAdReward } from "../models/ChallengeAdReward.js";
import { challengeAdRewardDay, NAVIGATION_CHALLENGE_REWARD } from "../lib/challenge-ad-reward.js";
import {
  REWARDED_AD_PLACEMENTS,
  RewardedAdSession
} from "../models/RewardedAdSession.js";
import { creditCoins, getCoinBalance } from "./coin.service.js";
import { challengeDayKey } from "./daily-challenge.service.js";
import { invalidateContestProgress } from "./contest-progress.service.js";
import { User } from "../models/User.js";
import { CHALLENGE_AD_COOLDOWN_MS, requireChallengeAdOffer } from "./challenge-ad-offer.service.js";

export type RewardedAdPlacement = (typeof REWARDED_AD_PLACEMENTS)[number];
export type RewardedAdProvider = "yandex" | "appodeal";

const SESSION_TTL_MS = 20 * 60 * 1000;
const CALLBACK_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const COIN_REWARDS: Partial<Record<RewardedAdPlacement, number>> = {
  "challenge-third-game": 75,
  "navigation-frequency": NAVIGATION_CHALLENGE_REWARD
};

const FORTUNE_REWARDS = [
  { coins: 1000, label: "+1000", weight: 1 },
  { coins: 500, label: "+500", weight: 3 },
  { coins: 200, label: "+200", weight: 7 },
  { coins: 150, label: "+150", weight: 19 },
  { coins: 50, label: "+50", weight: 70 }
] as const;

function fortuneReward() {
  const total = FORTUNE_REWARDS.reduce((sum, reward) => sum + reward.weight, 0);
  let cursor = Math.floor(Math.random() * total);
  for (const reward of FORTUNE_REWARDS) {
    cursor -= reward.weight;
    if (cursor < 0) return reward;
  }
  return FORTUNE_REWARDS[FORTUNE_REWARDS.length - 1]!;
}

function serializeSession(session: {
  sessionId: string;
  provider: string;
  placement: string;
  status: string;
  rewardCoins: number;
  rewardLabel?: string | null;
  expiresAt: Date;
}) {
  return {
    sessionId: session.sessionId,
    provider: session.provider as RewardedAdProvider,
    placement: session.placement,
    status: session.status,
    rewardCoins: session.rewardCoins,
    ...(session.rewardLabel ? { rewardLabel: session.rewardLabel } : {}),
    expiresAt: session.expiresAt.toISOString()
  };
}

export async function startRewardedAdSession(
  userId: Types.ObjectId,
  placement: RewardedAdPlacement,
  provider: RewardedAdProvider = "yandex"
) {
  // Keep only one pending session per user so a delayed callback can never
  // complete a different reward flow.
  const offer = placement === "navigation-frequency" ? await requireChallengeAdOffer(userId) : null;
  await RewardedAdSession.updateMany(
    { userId, status: "started" },
    { $set: { status: "expired", expiresAt: new Date() } }
  );
  const fortune = placement === "fortune-wheel" ? fortuneReward() : null;
  const session = await RewardedAdSession.create({
    sessionId: randomUUID(),
    userId,
    provider,
    placement,
    rewardCoins: fortune?.coins ?? COIN_REWARDS[placement] ?? 0,
    rewardLabel: fortune?.label,
    ...(offer?.challengeSetId ? { challengeSetId: offer.challengeSetId } : {}),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS)
  });
  return serializeSession(session);
}

async function findOwnedSession(userId: Types.ObjectId, sessionId: string) {
  const session = await RewardedAdSession.findOne({ userId, sessionId });
  if (!session) throw new ApiError(404, "rewarded_ad_session_not_found", "Ad session not found");
  if (session.expiresAt.getTime() < Date.now() && session.status === "started") {
    session.status = "expired";
    await session.save();
  }
  return session;
}

export async function completeRewardedAdFromClient(input: {
  userId: Types.ObjectId;
  sessionId: string;
  clientReceiptId: string;
}) {
  const session = await findOwnedSession(input.userId, input.sessionId);
  if (session.status === "expired") {
    throw new ApiError(409, "rewarded_ad_session_expired", "Ad session expired");
  }
  if (session.status !== "started") return serializeSession(session);

  const clientVerificationAllowed =
    env.NODE_ENV !== "production" ||
    (session.provider === "yandex"
      ? env.YANDEX_ALLOW_CLIENT_CALLBACK
      : env.APPODEAL_ALLOW_CLIENT_CALLBACK);
  session.clientReceiptId = input.clientReceiptId;
  if (clientVerificationAllowed) {
    session.status = "completed";
    session.completedAt = new Date();
  }
  await session.save();
  return serializeSession(session);
}

export async function getRewardedAdSession(
  userId: Types.ObjectId,
  sessionId: string
) {
  return serializeSession(await findOwnedSession(userId, sessionId));
}

export async function consumeRewardedAdSession(input: {
  userId: Types.ObjectId;
  sessionId: string;
  placements: readonly RewardedAdPlacement[];
}) {
  const session = await RewardedAdSession.findOneAndUpdate(
    {
      userId: input.userId,
      sessionId: input.sessionId,
      status: "completed",
      placement: { $in: input.placements },
      expiresAt: { $gt: new Date() }
    },
    { $set: { status: "claimed", claimedAt: new Date() } },
    { new: true }
  );
  if (!session) {
    throw new ApiError(
      409,
      "rewarded_ad_not_verified",
      "Rewarded video has not been verified or was already used"
    );
  }
  return session;
}

export async function claimRewardedAdCoins(input: {
  userId: Types.ObjectId;
  sessionId: string;
}) {
  const databaseSession = await mongoose.startSession();
  try {
    let rewardCoins = 0;
    let idempotentReplay = false;
    let challengeDay: string | null = null;
    await databaseSession.withTransaction(async () => {
      const adSession = await RewardedAdSession.findOne({
        userId: input.userId,
        sessionId: input.sessionId
      }).session(databaseSession);
      if (!adSession) {
        throw new ApiError(404, "rewarded_ad_session_not_found", "Ad session not found");
      }
      if (adSession.status === "claimed") {
        rewardCoins = 0;
        idempotentReplay = true;
        const previous = await ChallengeAdReward.findOne({ sessionId: adSession.sessionId }).session(databaseSession);
        challengeDay = previous?.dayKey ?? null;
        return;
      }
      if (adSession.status !== "completed" || adSession.expiresAt.getTime() < Date.now()) {
        throw new ApiError(409, "rewarded_ad_not_verified", "Rewarded video is not verified");
      }
      if (adSession.rewardCoins <= 0) {
        throw new ApiError(409, "rewarded_ad_has_no_coin_reward", "This placement has no coin reward");
      }
      if (adSession.placement === "navigation-frequency") {
        const now = new Date();
        await requireChallengeAdOffer(input.userId, now, databaseSession, adSession.challengeSetId?.toString());
        // One atomic user-level lock protects simultaneous claims on different devices.
        const locked = await User.updateOne({ _id: input.userId, $or: [
          { challengeAdAvailableAt: { $exists: false } }, { challengeAdAvailableAt: null }, { challengeAdAvailableAt: { $lte: now } },
        ] }, { $set: { challengeAdAvailableAt: new Date(now.getTime() + CHALLENGE_AD_COOLDOWN_MS) } }, { session: databaseSession });
        if (locked.modifiedCount !== 1) throw new ApiError(429, "challenge_ad_cooldown", "Награда уже получена. Подождите 5 минут.");
        const today = challengeDayKey(now);
        const set = await DailyChallengeSet.findOne({ dayKey: today }).session(databaseSession);
        challengeDay = challengeAdRewardDay(today, set, now);
        adSession.rewardCoins = NAVIGATION_CHALLENGE_REWARD;
        await ChallengeAdReward.create([{
          userId: input.userId, sessionId: adSession.sessionId,
          dayKey: challengeDay, amount: NAVIGATION_CHALLENGE_REWARD,
        }], { session: databaseSession });
        rewardCoins = NAVIGATION_CHALLENGE_REWARD;
      } else {
        const credited = await creditCoins(
          {
            userId: input.userId,
            amount: adSession.rewardCoins,
            type: "rewarded_ad_reward",
            sourceId: `rewarded-ad:${adSession.sessionId}`,
            description: `${adSession.provider} rewarded video`,
            metadata: { placement: adSession.placement, provider: adSession.provider }
          },
          databaseSession
        );
        rewardCoins = credited.idempotentReplay ? 0 : adSession.rewardCoins;
      }
      adSession.status = "claimed";
      adSession.claimedAt = new Date();
      await adSession.save({ session: databaseSession });
    });
    if (challengeDay && !idempotentReplay) invalidateContestProgress(challengeDay);
    return {
      sessionId: input.sessionId,
      credited: rewardCoins,
      idempotentReplay,
      challengeDayKey: challengeDay,
      coins: await getCoinBalance(input.userId)
    };
  } finally {
    await databaseSession.endSession();
  }
}

export async function claimFirstChallengeReplay(input: {
  userId: Types.ObjectId;
  sessionId: string;
  gameKey: string;
}) {
  const game = await Game.findOne({ key: input.gameKey, enabled: true }).select("_id key");
  if (!game) throw new ApiError(404, "game_not_found", "Game not found");
  const dayKey = challengeDayKey();
  const set = await DailyChallengeSet.findOne({
    dayKey,
    status: "published",
    "gameIds.0": game._id
  }).select("_id");
  if (!set) {
    throw new ApiError(409, "rewarded_replay_not_available", "Replay is only available for today's first challenge game");
  }
  const attempt = await ChallengeAttempt.findOne({
    userId: input.userId,
    dailyChallengeSetId: set._id,
    gameId: game._id,
    mode: "challenge",
    status: "completed"
  }).select("_id");
  if (!attempt) {
    throw new ApiError(409, "completed_attempt_required", "Complete the first challenge game before replaying it");
  }
  await consumeRewardedAdSession({
    userId: input.userId,
    sessionId: input.sessionId,
    placements: ["challenge-first-replay"]
  });
  const updated = await ChallengeAttempt.findOneAndUpdate(
    { _id: attempt._id, status: "completed" },
    {
      $set: { status: "started", startedAt: new Date(), coinsAwarded: 0 },
      $unset: { completedAt: 1, score: 1, durationMs: 1 },
      $inc: { "metadata.adReplayCount": 1 }
    },
    { new: true }
  );
  if (!updated) {
    throw new ApiError(409, "completed_attempt_required", "The challenge is no longer replayable");
  }
  return { gameKey: game.key, replayCount: 1 };
}

function safeHashEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left.toLowerCase(), "utf8");
  const rightBytes = Buffer.from(right.toLowerCase(), "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export async function verifyAppodealServerCallback(data1: string, data2: string) {
  if (!env.APPODEAL_REWARD_CALLBACK_SECRET) {
    throw new ApiError(503, "appodeal_callback_not_configured", "Appodeal callback is not configured");
  }
  try {
    const key = createHash("sha256")
      .update(env.APPODEAL_REWARD_CALLBACK_SECRET, "utf8")
      .digest();
    const decipher = createDecipheriv("aes-256-cbc", key, Buffer.from(data1, "hex"));
    const decrypted = decipher.update(data2, "hex", "utf8") + decipher.final("utf8");
    const values = parseQueryString(decrypted);
    const userId = String(values.user_id ?? "");
    const amount = String(values.amount ?? "");
    const currency = String(values.currency ?? "");
    const impressionId = String(values.impression_id ?? "");
    const timestamp = String(values.timestamp ?? "");
    const suppliedHash = String(values.hash ?? "");
    const expectedHash = createHash("sha1")
      .update(
        `user_id=${userId}&amount=${amount}&currency=${currency}&impression_id=${impressionId}&timestamp=${timestamp}`
      )
      .digest("hex");
    if (!safeHashEqual(suppliedHash, expectedHash)) throw new Error("hash mismatch");
    if (!Types.ObjectId.isValid(userId) || !impressionId) throw new Error("invalid callback data");
    const numericTimestamp = Number(timestamp);
    const timestampMs = numericTimestamp < 10_000_000_000 ? numericTimestamp * 1000 : numericTimestamp;
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > CALLBACK_MAX_AGE_MS) {
      throw new Error("stale callback");
    }

    const duplicate = await RewardedAdSession.findOne({ impressionId });
    if (duplicate) return { accepted: true, duplicate: true };
    const session = await RewardedAdSession.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        status: "started",
        expiresAt: { $gt: new Date() }
      },
      {
        $set: {
          status: "completed",
          completedAt: new Date(),
          impressionId
        }
      },
      { new: true, sort: { createdAt: -1 } }
    );
    if (!session) throw new ApiError(404, "rewarded_ad_session_not_found", "No pending ad session");
    return { accepted: true, duplicate: false };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "invalid_appodeal_callback", "Invalid Appodeal callback");
  }
}
