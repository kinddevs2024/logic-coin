import mongoose, { Types, type ClientSession } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { GiftItem } from "../models/GiftItem.js";
import { creditCoins } from "./coin.service.js";
import { findActiveGameByKey } from "./game.service.js";

export type GiftKind = "time_extension" | "extra_time" | "replay" | "coin";

export interface GrantGiftInput {
  userId: Types.ObjectId;
  kind: GiftKind;
  amountSeconds?: number;
  replayCount?: number;
  coinAmount?: number;
  sourceId: string;
  description: string;
}

function assertGiftAmount(input: GrantGiftInput) {
  if (
    (input.kind === "time_extension" || input.kind === "extra_time") &&
    (!Number.isSafeInteger(input.amountSeconds) || (input.amountSeconds ?? 0) <= 0)
  ) {
    throw new ApiError(500, "invalid_gift_amount", "Time gift amount must be a positive integer");
  }
  if (
    input.kind === "replay" &&
    (!Number.isSafeInteger(input.replayCount) || (input.replayCount ?? 0) <= 0)
  ) {
    throw new ApiError(500, "invalid_gift_amount", "Replay gift amount must be a positive integer");
  }
  if (
    input.kind === "coin" &&
    (!Number.isSafeInteger(input.coinAmount) || (input.coinAmount ?? 0) <= 0)
  ) {
    throw new ApiError(500, "invalid_gift_amount", "Coin gift amount must be a positive integer");
  }
}

export async function grantGift(input: GrantGiftInput, session: ClientSession) {
  assertGiftAmount(input);
  const existing = await GiftItem.findOne({
    userId: input.userId,
    sourceId: input.sourceId
  }).session(session);
  if (existing) {
    return { gift: existing, granted: false };
  }
  const [gift] = await GiftItem.create([input], { session });
  return { gift, granted: true };
}

function serializeGift(gift: {
  _id: { toString(): string };
  kind: GiftKind | string;
  amountSeconds?: number | null;
  replayCount?: number | null;
  coinAmount?: number | null;
  status: string;
  description: string;
  usedAt?: Date | null;
  usedOnGameKey?: string | null;
  createdAt: Date;
}) {
  return {
    id: gift._id.toString(),
    kind: gift.kind,
    amountSeconds: gift.amountSeconds ?? null,
    replayCount: gift.replayCount ?? null,
    coinAmount: gift.coinAmount ?? null,
    status: gift.status,
    description: gift.description,
    usedAt: gift.usedAt?.toISOString() ?? null,
    usedOnGameKey: gift.usedOnGameKey ?? null,
    createdAt: gift.createdAt.toISOString()
  };
}

export async function listGifts(userId: Types.ObjectId) {
  const gifts = await GiftItem.find({ userId }).sort({ status: 1, createdAt: -1 }).limit(100);
  return gifts.map((gift) => serializeGift(gift));
}

export async function useGift(input: {
  userId: Types.ObjectId;
  giftId: string;
  gameKey?: string;
}) {
  if (!Types.ObjectId.isValid(input.giftId)) {
    throw new ApiError(400, "invalid_gift_id", "Gift id is invalid");
  }
  const preview = await GiftItem.findOne({
    _id: input.giftId,
    userId: input.userId,
    status: "available"
  }).lean();
  if (!preview) {
    throw new ApiError(409, "gift_unavailable", "Gift is missing or already used");
  }

  const kind = preview.kind as GiftKind;
  const needsGame = kind !== "coin";
  if (needsGame && !input.gameKey) {
    throw new ApiError(400, "game_key_required", "This gift must be applied to a game");
  }
  const game = needsGame ? await findActiveGameByKey(input.gameKey!) : null;
  const session = await mongoose.startSession();
  let serialized: ReturnType<typeof serializeGift> | undefined;
  let effect:
    | { kind: "time_extension"; additionalTimeSeconds: number }
    | { kind: "replay"; replayCount: number; gameKey: string }
    | { kind: "coin"; coinsCredited: number }
    | undefined;
  try {
    await session.withTransaction(async () => {
      if (kind === "time_extension" || kind === "extra_time") {
        const activeAttempt = await ChallengeAttempt.findOne({
          userId: input.userId,
          gameId: game!._id,
          mode: "challenge",
          status: "started"
        })
          .select("_id")
          .session(session);
        if (!activeAttempt) {
          throw new ApiError(
            409,
            "active_attempt_required",
            "Start this challenge before using an extra-time gift"
          );
        }
        const seconds = preview.amountSeconds ?? 0;
        const attemptUpdate = await ChallengeAttempt.updateOne(
          { _id: activeAttempt._id, status: "started" },
          { $inc: { "metadata.extraTimeSecondsGranted": seconds } },
          { session }
        );
        if (attemptUpdate.matchedCount !== 1) {
          throw new ApiError(
            409,
            "active_attempt_required",
            "The game attempt ended before the gift could be applied"
          );
        }
        effect = { kind: "time_extension", additionalTimeSeconds: seconds };
      } else if (kind === "replay") {
        const completedAttempt = await ChallengeAttempt.findOne({
          userId: input.userId,
          gameId: game!._id,
          mode: "challenge",
          status: "completed"
        })
          .select("_id gameKey")
          .session(session);
        if (!completedAttempt) {
          throw new ApiError(
            409,
            "completed_attempt_required",
            "Complete this challenge before using a replay gift"
          );
        }
        const attemptUpdate = await ChallengeAttempt.updateOne(
          { _id: completedAttempt._id, status: "completed" },
          {
            $set: { status: "started", startedAt: new Date(), coinsAwarded: 0 },
            $unset: { completedAt: 1, score: 1, durationMs: 1 },
            $inc: { "metadata.replayCount": preview.replayCount ?? 1 }
          },
          { session }
        );
        if (attemptUpdate.matchedCount !== 1) {
          throw new ApiError(409, "completed_attempt_required", "The challenge is no longer replayable");
        }
        effect = {
          kind: "replay",
          replayCount: preview.replayCount ?? 1,
          gameKey: game!.key
        };
      } else {
        const amount = preview.coinAmount ?? 0;
        await creditCoins(
          {
            userId: input.userId,
            amount,
            type: "case_coin_reward",
            sourceId: `gift:${preview._id.toString()}`,
            description: preview.description,
            metadata: { giftId: preview._id.toString() }
          },
          session
        );
        effect = { kind: "coin", coinsCredited: amount };
      }

      const gift = await GiftItem.findOneAndUpdate(
        { _id: input.giftId, userId: input.userId, status: "available", kind },
        {
          $set: {
            status: "used",
            usedAt: new Date(),
            ...(game ? { usedOnGameKey: game.key } : {})
          }
        },
        { new: true, session }
      );
      if (!gift) {
        throw new ApiError(409, "gift_unavailable", "Gift is missing or already used");
      }
      serialized = serializeGift(gift);
    });
  } finally {
    await session.endSession();
  }
  if (!serialized || !effect) {
    throw new ApiError(500, "gift_use_failed", "Gift could not be used");
  }
  return { gift: serialized, effect };
}
