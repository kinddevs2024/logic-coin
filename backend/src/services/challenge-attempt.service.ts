import mongoose, { type Types } from "mongoose";
import {
  DAILY_CHALLENGE_GAME_COUNT,
  MAX_CHALLENGE_DURATION_MS,
  MAX_CHALLENGE_SCORE,
  MAX_GAME_COINS
} from "../config/constants.js";
import { ApiError } from "../lib/api-error.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { User } from "../models/User.js";
import { creditCoins } from "./coin.service.js";
import { challengeDayKey, getDailyChallengeSet } from "./daily-challenge.service.js";
import { findActiveGameByKey } from "./game.service.js";
import { creditReferralCoinPrizeShare } from "./referral.service.js";
import { verifyRewardedAd, type RewardedAdProof } from "./rewarded-ad.service.js";
import { serializeCoins } from "./serialization.service.js";

async function dailyGame(input: { gameKey: string; dayKey: string }) {
  const game = await findActiveGameByKey(input.gameKey);
  const set = await getDailyChallengeSet(input.dayKey);
  if (!set || set.status !== "published") {
    throw new ApiError(409, "challenges_not_published", "Today's challenges are not published");
  }
  const inSet = (set.gameIds as Types.ObjectId[]).some((gameId) => gameId.equals(game._id));
  if (!inSet) {
    throw new ApiError(409, "game_not_in_today_set", "This game is not part of today's challenges");
  }
  return { game, set };
}

function validateScore(score: number) {
  if (!Number.isSafeInteger(score) || score < 0 || score > MAX_CHALLENGE_SCORE) {
    throw new ApiError(
      400,
      "invalid_score",
      `Score must be an integer between 0 and ${MAX_CHALLENGE_SCORE}`
    );
  }
}

function validateDuration(durationMs?: number) {
  if (
    durationMs !== undefined &&
    (!Number.isSafeInteger(durationMs) || durationMs < 0 || durationMs > MAX_CHALLENGE_DURATION_MS)
  ) {
    throw new ApiError(400, "invalid_duration", "Duration is out of range");
  }
}

export function challengeCoinsForScore(score: number, maxCoins = MAX_GAME_COINS): number {
  validateScore(score);
  if (!Number.isSafeInteger(maxCoins) || maxCoins < 1 || maxCoins > MAX_GAME_COINS) {
    throw new ApiError(500, "invalid_game_coin_cap", "Game coin cap is invalid");
  }
  // One authoritative formula is shared by challenge and practice modes.
  // Outcome flags are intentionally ignored because the client must not be
  // able to increase an economy reward by claiming a win.
  return Math.min(maxCoins, 25 + Math.floor(score / 20));
}

function cappedGameCoins(amount: number) {
  return Math.min(MAX_GAME_COINS, Math.max(0, Math.round(amount)));
}

export async function startChallengeAttempt(input: {
  userId: Types.ObjectId;
  gameKey: string;
}) {
  const dayKey = challengeDayKey();
  const { game, set } = await dailyGame({ gameKey: input.gameKey, dayKey });
  const existing = await ChallengeAttempt.findOne({
    userId: input.userId,
    dayKey,
    gameId: game._id,
    mode: "challenge"
  });
  if (existing?.status === "started") {
    return {
      attemptId: existing._id.toString(),
      dayKey,
      gameKey: game.key,
      status: existing.status,
      resumed: true
    };
  }
  const completedAttempts = await ChallengeAttempt.countDocuments({
    userId: input.userId,
    dayKey,
    gameId: game._id,
    mode: "challenge",
    status: "completed"
  });
  if (completedAttempts >= (set.maxAttemptsPerGame ?? 1)) {
    throw new ApiError(409, "challenge_attempt_limit_reached", "The challenge attempt limit has been reached");
  }

  try {
    const attempt = await ChallengeAttempt.create({
      userId: input.userId,
      gameId: game._id,
      gameKey: game.key,
      dailyChallengeSetId: set._id,
      dayKey,
      mode: "challenge",
      attemptNumber: completedAttempts + 1,
      status: "started",
      startedAt: new Date()
    });
    return {
      attemptId: attempt._id.toString(),
      dayKey,
      gameKey: game.key,
      status: attempt.status,
      resumed: false
    };
  } catch (error) {
    if ((error as { code?: number }).code !== 11_000) throw error;
    const concurrent = await ChallengeAttempt.findOne({
      userId: input.userId,
      dayKey,
      gameId: game._id,
      mode: "challenge"
    });
    if (!concurrent || concurrent.status === "completed") {
      throw new ApiError(409, "challenge_already_completed", "This challenge is already completed today");
    }
    return {
      attemptId: concurrent._id.toString(),
      dayKey,
      gameKey: game.key,
      status: concurrent.status,
      resumed: true
    };
  }
}

export async function completeChallengeAttempt(input: {
  userId: Types.ObjectId;
  gameKey: string;
  score: number;
  durationMs?: number;
}) {
  validateScore(input.score);
  validateDuration(input.durationMs);
  const dayKey = challengeDayKey();
  const { game } = await dailyGame({ gameKey: input.gameKey, dayKey });
  const maxCoins = Math.min(MAX_GAME_COINS, game.scoring?.maxCoins ?? MAX_GAME_COINS);
  const coinsAwarded = challengeCoinsForScore(input.score, maxCoins);

  const session = await mongoose.startSession();
  let attemptResult:
    | {
        id: string;
        gameKey: string;
        dayKey: string;
        score: number;
        coinsAwarded: number;
        completedAt: string | null;
        idempotentReplay: boolean;
      }
    | undefined;
  try {
    await session.withTransaction(async () => {
      const attempt = await ChallengeAttempt.findOneAndUpdate(
        {
          userId: input.userId,
          dayKey,
          gameId: game._id,
          mode: "challenge",
          status: "started"
        },
        {
          $set: {
            status: "completed",
            completedAt: new Date(),
            score: input.score,
            coinsAwarded,
            ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {})
          }
        },
        { new: true, session }
      );
      if (!attempt) {
        const existing = await ChallengeAttempt.findOne({
          userId: input.userId,
          dayKey,
          gameId: game._id,
          mode: "challenge",
          status: "completed"
        }).session(session);
        if (!existing) {
          throw new ApiError(409, "attempt_not_started", "Start the challenge before submitting a score");
        }
        attemptResult = {
          id: existing._id.toString(),
          gameKey: existing.gameKey,
          dayKey,
          score: existing.score ?? 0,
          coinsAwarded: existing.coinsAwarded ?? 0,
          completedAt: existing.completedAt?.toISOString() ?? null,
          idempotentReplay: true
        };
        return;
      }
      if (coinsAwarded > 0) {
        const attemptMetadata = (attempt.metadata ?? {}) as { replayCount?: number };
        const replayCount = Math.max(0, Number(attemptMetadata.replayCount ?? 0));
        const rewardSourceId = replayCount > 0
          ? `${attempt._id.toString()}:replay:${replayCount}`
          : attempt._id.toString();
        await creditCoins(
          {
            userId: input.userId,
            amount: coinsAwarded,
            type: "challenge_coin_reward",
            sourceId: rewardSourceId,
            description: `Challenge reward: ${game.key}`,
            metadata: { dayKey, gameKey: game.key, kind: "base" }
          },
          session
        );
        await creditReferralCoinPrizeShare(
          {
            winnerUserId: input.userId,
            winnerPrizeCoins: coinsAwarded,
            dayKey,
            sourceId: rewardSourceId
          },
          session
        );
      }
      attemptResult = {
        id: attempt._id.toString(),
        gameKey: game.key,
        dayKey,
        score: attempt.score ?? 0,
        coinsAwarded: attempt.coinsAwarded ?? 0,
        completedAt: attempt.completedAt?.toISOString() ?? null,
        idempotentReplay: false
      };
    });
  } finally {
    await session.endSession();
  }
  if (!attemptResult) {
    throw new ApiError(500, "challenge_completion_failed", "Challenge completion failed");
  }
  const user = await User.findById(input.userId).select("coins");
  return { attempt: attemptResult, coins: serializeCoins(user?.coins) };
}

export async function completePracticeAttempt(input: {
  userId: Types.ObjectId;
  gameKey: string;
  score: number;
  durationMs?: number;
}) {
  validateScore(input.score);
  validateDuration(input.durationMs);
  const game = await findActiveGameByKey(input.gameKey);
  if (!game.practiceEnabled) {
    throw new ApiError(409, "practice_disabled", "Practice mode is disabled for this game");
  }
  const maxCoins = Math.min(MAX_GAME_COINS, game.scoring?.maxCoins ?? MAX_GAME_COINS);
  const coinsAwarded = challengeCoinsForScore(input.score, maxCoins);
  const now = new Date();
  const session = await mongoose.startSession();
  let attempt:
    | {
        id: string;
        gameKey: string;
        mode: "practice";
        score: number;
        coinsAwarded: number;
        completedAt: string | null;
      }
    | undefined;
  try {
    await session.withTransaction(async () => {
      const [created] = await ChallengeAttempt.create(
        [
          {
            userId: input.userId,
            gameId: game._id,
            gameKey: game.key,
            mode: "practice",
            status: "completed",
            startedAt: now,
            completedAt: now,
            score: input.score,
            coinsAwarded,
            ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {})
          }
        ],
        { session }
      );
      if (!created) {
        throw new ApiError(500, "practice_completion_failed", "Practice result could not be saved");
      }
      if (coinsAwarded > 0) {
        await creditCoins(
          {
            userId: input.userId,
            amount: coinsAwarded,
            type: "practice_coin_reward",
            sourceId: created._id.toString(),
            description: `Practice reward: ${game.key}`,
            metadata: { gameKey: game.key, kind: "practice" }
          },
          session
        );
      }
      attempt = {
        id: created._id.toString(),
        gameKey: game.key,
        mode: "practice",
        score: created.score ?? 0,
        coinsAwarded: created.coinsAwarded ?? 0,
        completedAt: created.completedAt?.toISOString() ?? null
      };
    });
  } finally {
    await session.endSession();
  }
  if (!attempt) {
    throw new ApiError(500, "practice_completion_failed", "Practice completion failed");
  }
  const user = await User.findById(input.userId).select("coins");
  return {
    attempt,
    coins: serializeCoins(user?.coins)
  };
}

export async function doubleChallengeCoins(input: {
  userId: Types.ObjectId;
  scope: "game" | "day";
  ad?: RewardedAdProof;
}) {
  const adVerification = await verifyRewardedAd(input.ad);
  const dayKey = challengeDayKey();
  const set = await getDailyChallengeSet(dayKey);
  if (!set || set.status !== "published") {
    throw new ApiError(409, "challenges_not_published", "Today's challenges are not published");
  }
  const gameIds = set.gameIds as Types.ObjectId[];
  if (gameIds.length !== DAILY_CHALLENGE_GAME_COUNT) {
    throw new ApiError(409, "no_challenges_today", "There are no complete challenges today");
  }

  const session = await mongoose.startSession();
  let credited = 0;
  let idempotentReplay = false;
  try {
    await session.withTransaction(async () => {
      if (input.scope === "game") {
        const firstGameId = gameIds[0]!;
        const attempt = await ChallengeAttempt.findOne({
          userId: input.userId,
          dayKey,
          gameId: firstGameId,
          mode: "challenge",
          status: "completed"
        }).session(session);
        if (!attempt || (attempt.coinsAwarded ?? 0) <= 0) {
          throw new ApiError(409, "first_game_not_completed", "Finish the first game before doubling");
        }
        const claimed = await ChallengeAttempt.findOneAndUpdate(
          { _id: attempt._id, "metadata.doubled": { $ne: true } },
          {
            $set: {
              "metadata.doubled": true,
              "metadata.doubleAdReceiptId": adVerification.receiptId
            }
          },
          { new: true, session }
        );
        if (!claimed) {
          idempotentReplay = true;
          return;
        }
        const doubleCredit = Math.max(0, MAX_GAME_COINS - cappedGameCoins(attempt.coinsAwarded!));
        if (doubleCredit === 0) {
          idempotentReplay = true;
          return;
        }
        const reward = await creditCoins(
          {
            userId: input.userId,
            amount: doubleCredit,
            type: "challenge_coin_reward",
            sourceId: `double-game:${attempt._id.toString()}`,
            description: `Double coins: ${attempt.gameKey}`,
            metadata: { dayKey, gameKey: attempt.gameKey, kind: "double-game" }
          },
          session
        );
        await creditReferralCoinPrizeShare(
          {
            winnerUserId: input.userId,
            winnerPrizeCoins: doubleCredit,
            dayKey,
            sourceId: `double-game:${attempt._id.toString()}`
          },
          session
        );
        credited = reward.idempotentReplay ? 0 : doubleCredit;
        idempotentReplay = reward.idempotentReplay;
        return;
      }

      const attempts = await ChallengeAttempt.find({
        userId: input.userId,
        dayKey,
        mode: "challenge",
        status: "completed",
        gameId: { $in: gameIds }
      })
        .select("gameId coinsAwarded")
        .session(session)
        .lean();
      if (new Set(attempts.map((attempt) => attempt.gameId.toString())).size !== gameIds.length) {
        throw new ApiError(409, "day_not_completed", "Complete all today's challenges before doubling");
      }
      const baseTotal = attempts.reduce(
        (sum, attempt) => sum + Math.max(0, MAX_GAME_COINS - cappedGameCoins(attempt.coinsAwarded ?? 0)),
        0,
      );
      if (baseTotal <= 0) {
        throw new ApiError(409, "nothing_to_double", "There are no coins to double today");
      }
      const reward = await creditCoins(
        {
          userId: input.userId,
          amount: baseTotal,
          type: "challenge_coin_reward",
          sourceId: `double-day:${dayKey}`,
          description: `Double daily coins (${dayKey})`,
          metadata: { dayKey, kind: "double-day", adReceiptId: adVerification.receiptId }
        },
        session
      );
      await creditReferralCoinPrizeShare(
        {
          winnerUserId: input.userId,
          winnerPrizeCoins: baseTotal,
          dayKey,
          sourceId: `double-day:${dayKey}`
        },
        session
      );
      credited = reward.idempotentReplay ? 0 : baseTotal;
      idempotentReplay = reward.idempotentReplay;
    });
  } finally {
    await session.endSession();
  }

  const user = await User.findById(input.userId).select("coins");
  return {
    scope: input.scope,
    credited,
    idempotentReplay,
    coins: serializeCoins(user?.coins),
    adVerification
  };
}
