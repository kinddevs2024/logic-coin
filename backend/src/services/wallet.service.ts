import type { ClientSession, Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { ActivityDay } from "../models/ActivityDay.js";
import { LedgerEntry } from "../models/LedgerEntry.js";
import { User } from "../models/User.js";
import { MICROS_PER_CENT } from "../lib/percent-contest-plan.js";

type LedgerType =
  | "task_reward"
  | "daily_bonus"
  | "weekly_bonus"
  | "monthly_bonus"
  | "referral_bonus"
  | "game_reward"
  | "contest_cash_prize"
  | "raffle_cash_prize";

interface CreditRewardInput {
  userId: Types.ObjectId;
  amountUnits: number;
  type: LedgerType;
  sourceId: string;
  description: string;
  dayKey?: string;
  referralReward?: boolean;
  metadata?: Record<string, unknown>;
}

export async function creditReward(input: CreditRewardInput, session: ClientSession) {
  const amountMicros = Math.round(input.amountUnits * MICROS_PER_CENT);
  const fractionalContest = input.type === "contest_cash_prize" && amountMicros > 0 && Number.isSafeInteger(amountMicros)
    && Math.abs(amountMicros / MICROS_PER_CENT - input.amountUnits) < 1e-10;
  if ((!Number.isSafeInteger(input.amountUnits) && !fractionalContest) || !Number.isFinite(input.amountUnits) || input.amountUnits <= 0) {
    throw new ApiError(500, "invalid_reward", "Reward must be a positive integer");
  }

  const increments: Record<string, number> = {
    "wallet.availableUnits": input.amountUnits,
    "wallet.lifetimeEarnedUnits": input.amountUnits
  };
  if (input.referralReward) {
    increments["wallet.referralEarnedUnits"] = input.amountUnits;
  }

  const user = await User.findOneAndUpdate(
    { _id: input.userId },
    fractionalContest && !Number.isInteger(input.amountUnits)
      ? [{ $set: Object.fromEntries(Object.entries(increments).map(([key, amount]) => [key,
          { $round: [{ $add: [{ $ifNull: [`$${key}`, 0] }, amount] }, 4] },
        ])) }]
      : { $inc: increments },
    { new: true, session }
  ).select("wallet");

  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }

  const balanceAfterUnits = user.wallet.availableUnits;
  await LedgerEntry.create(
    [
      {
        userId: input.userId,
        type: input.type,
        amountUnits: input.amountUnits,
        ...(input.type === "contest_cash_prize" ? { amountMicros } : {}),
        balanceAfterUnits,
        sourceId: input.sourceId,
        description: input.description,
        ...(input.metadata ? { metadata: input.metadata } : {})
      }
    ],
    { session }
  );

  if (input.dayKey) {
    const now = new Date();
    await ActivityDay.updateOne(
      { userId: input.userId, dayKey: input.dayKey },
      {
        $inc: { actionCount: 1, rewardUnits: input.amountUnits },
        $set: { lastActivityAt: now },
        $setOnInsert: { firstActivityAt: now }
      },
      { upsert: true, session }
    );
  }

  return { balanceAfterUnits };
}
