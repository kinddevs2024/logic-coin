import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { Game } from "../models/Game.js";
import {
  REWARDED_AD_PLACEMENTS,
  RewardedAdSession
} from "../models/RewardedAdSession.js";
import { creditCoins, getCoinBalance } from "./coin.service.js";
import { challengeDayKey } from "./daily-challenge.service.js";

export type RewardedAdPlacement = (typeof REWARDED_AD_PLACEMENTS)[number];
export type RewardedAdProvider = "yandex" | "appodeal";

const SESSION_TTL_MS = 20 * 60 * 1000;
const COIN_REWARDS: Partial<Record<RewardedAdPlacement, number>> = {
  "challenge-third-game": 75,
  "navigation-frequency": 25
};

function serializeSession(session: {
  sessionId: string;
  provider: string;
  placement: string;
  status: string;
  rewardCoins: number;
  expiresAt: Date;
}) {
  return {
    sessionId: session.sessionId,
    provider: session.provider as RewardedAdProvider,
    placement: session.placement,
    status: session.status,
    rewardCoins: session.rewardCoins,
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
  await RewardedAdSession.updateMany(
    { userId, status: "started" },
    { $set: { status: "expired", expiresAt: new Date() } }
  );
  const session = await RewardedAdSession.create({
    sessionId: randomUUID(),
    userId,
    provider,
    placement,
    rewardCoins: COIN_REWARDS[placement] ?? 0,
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
    (session.provider === "yandex" && env.YANDEX_ALLOW_CLIENT_CALLBACK);
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
    await databaseSession.withTransaction(async () => {
      const adSession = await RewardedAdSession.findOne({
        userId: input.userId,
        sessionId: input.sessionId
      }).session(databaseSession);
      if (!adSession) {
        throw new ApiError(404, "rewarded_ad_session_not_found", "Ad session not found");
      }
      if (adSession.status === "claimed") {
        rewardCoins = adSession.rewardCoins;
        idempotentReplay = true;
        return;
      }
      if (adSession.status !== "completed" || adSession.expiresAt.getTime() < Date.now()) {
        throw new ApiError(409, "rewarded_ad_not_verified", "Rewarded video is not verified");
      }
      if (adSession.rewardCoins <= 0) {
        throw new ApiError(409, "rewarded_ad_has_no_coin_reward", "This placement has no coin reward");
      }
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
      adSession.status = "claimed";
      adSession.claimedAt = new Date();
      await adSession.save({ session: databaseSession });
    });
    return {
      sessionId: input.sessionId,
      credited: rewardCoins,
      idempotentReplay,
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
