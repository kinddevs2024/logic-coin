import mongoose, { type ClientSession, type Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import {
  CoinLedgerEntry,
  type COIN_LEDGER_TYPES
} from "../models/CoinLedgerEntry.js";
import { User } from "../models/User.js";
import { serializeCoins } from "./serialization.service.js";

export type CoinLedgerType = (typeof COIN_LEDGER_TYPES)[number];

export interface CreditCoinsInput {
  userId: Types.ObjectId;
  amount: number;
  type: CoinLedgerType;
  sourceId: string;
  description: string;
  referralReward?: boolean;
  metadata?: Record<string, unknown>;
}

async function creditCoinsInSession(input: CreditCoinsInput, session: ClientSession) {
  const existing = await CoinLedgerEntry.findOne({
    userId: input.userId,
    type: input.type,
    sourceId: input.sourceId
  }).session(session);
  if (existing) {
    return { balanceAfter: existing.balanceAfter, idempotentReplay: true };
  }

  const increments: Record<string, number> = {
    "coins.balance": input.amount,
    "coins.lifetimeEarned": input.amount
  };
  if (input.referralReward) {
    increments["coins.referralEarned"] = input.amount;
  }
  const user = await User.findOneAndUpdate(
    { _id: input.userId },
    { $inc: increments },
    { new: true, session }
  ).select("coins");
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }

  await CoinLedgerEntry.create(
    [
      {
        userId: input.userId,
        type: input.type,
        amount: input.amount,
        balanceAfter: user.coins.balance,
        sourceId: input.sourceId,
        description: input.description,
        ...(input.metadata ? { metadata: input.metadata } : {})
      }
    ],
    { session }
  );
  return { balanceAfter: user.coins.balance, idempotentReplay: false };
}

export async function creditCoins(input: CreditCoinsInput, session?: ClientSession) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new ApiError(500, "invalid_coin_amount", "Coin amount must be a positive integer");
  }
  if (session) {
    return creditCoinsInSession(input, session);
  }

  const ownedSession = await mongoose.startSession();
  let result: Awaited<ReturnType<typeof creditCoinsInSession>> | undefined;
  try {
    await ownedSession.withTransaction(async () => {
      result = await creditCoinsInSession(input, ownedSession);
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11_000) {
      const existing = await CoinLedgerEntry.findOne({
        userId: input.userId,
        type: input.type,
        sourceId: input.sourceId
      });
      if (existing) {
        return { balanceAfter: existing.balanceAfter, idempotentReplay: true };
      }
    }
    throw error;
  } finally {
    await ownedSession.endSession();
  }
  if (!result) {
    throw new ApiError(500, "coin_credit_failed", "Coin credit failed");
  }
  return result;
}

export async function getCoinBalance(userId: Types.ObjectId) {
  const user = await User.findById(userId).select("coins");
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  return serializeCoins(user.coins);
}
