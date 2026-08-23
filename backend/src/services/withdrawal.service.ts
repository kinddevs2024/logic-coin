import mongoose, { Types } from "mongoose";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { centsToUnits } from "../lib/money.js";
import { LedgerEntry } from "../models/LedgerEntry.js";
import { User } from "../models/User.js";
import { Withdrawal } from "../models/Withdrawal.js";
import { serializeWallet } from "./serialization.service.js";

export async function createSandboxWithdrawal(input: {
  userId: Types.ObjectId;
  amountCents: number;
  idempotencyKey: string;
  card: {
    brand: "visa" | "mastercard" | "other";
    last4: string;
    holderName: string;
    expiration: string;
  };
  agreementVersion: string;
}) {
  if (input.amountCents < env.MIN_WITHDRAWAL_CENTS) {
    throw new ApiError(409, "withdrawal_below_minimum", "Withdrawal amount is below the minimum", {
      minimumCents: env.MIN_WITHDRAWAL_CENTS
    });
  }

  let amountUnits: number;
  try {
    amountUnits = centsToUnits(input.amountCents);
  } catch {
    throw new ApiError(
      400,
      "invalid_withdrawal_increment",
      `Amount must be a multiple of ${env.UNIT_VALUE_CENTS} cents`
    );
  }

  const prior = await Withdrawal.findOne({
    userId: input.userId,
    idempotencyKey: input.idempotencyKey
  });
  if (prior) {
    const user = await User.findById(input.userId).select("wallet");
    return {
      withdrawal: prior,
      wallet: serializeWallet(user?.wallet),
      idempotentReplay: true
    };
  }

  const session = await mongoose.startSession();
  let withdrawalId: Types.ObjectId | null = null;
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const user = await User.findOneAndUpdate(
        {
          _id: input.userId,
          "wallet.availableUnits": { $gte: amountUnits }
        },
        {
          $inc: {
            "wallet.availableUnits": -amountUnits,
            "wallet.lockedUnits": amountUnits
          }
        },
        { new: true, session }
      ).select("wallet");
      if (!user) {
        throw new ApiError(409, "insufficient_funds", "Available balance is insufficient");
      }

      const [withdrawal] = await Withdrawal.create(
        [
          {
            userId: input.userId,
            idempotencyKey: input.idempotencyKey,
            amountCents: input.amountCents,
            amountUnits,
            method: "bank_card",
            accountLabel: `${input.card.brand.toUpperCase()} •••• ${input.card.last4}`,
            cardBrand: input.card.brand,
            cardLast4: input.card.last4,
            cardHolder: input.card.holderName,
            cardExpiration: input.card.expiration,
            agreementVersion: input.agreementVersion,
            status: "pending_review",
            requestedAt: now
          }
        ],
        { session }
      );
      if (!withdrawal) {
        throw new ApiError(500, "withdrawal_failed", "Withdrawal could not be created");
      }
      withdrawalId = withdrawal._id;

      await LedgerEntry.create(
        [
          {
            userId: input.userId,
            type: "withdrawal",
            amountUnits: -amountUnits,
            balanceAfterUnits: user.wallet.availableUnits,
            sourceId: withdrawal._id.toString(),
            description: "Bank card withdrawal review request",
            metadata: {
              amountCents: input.amountCents,
              method: "bank_card",
              cardBrand: input.card.brand,
              cardLast4: input.card.last4,
              agreementVersion: input.agreementVersion
            }
          }
        ],
        { session }
      );
    });
  } catch (error) {
    const mongoError = error as { code?: number };
    if (mongoError.code === 11_000) {
      const replay = await Withdrawal.findOne({
        userId: input.userId,
        idempotencyKey: input.idempotencyKey
      });
      if (replay) {
        const user = await User.findById(input.userId).select("wallet");
        return {
          withdrawal: replay,
          wallet: serializeWallet(user?.wallet),
          idempotentReplay: true
        };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }

  const [withdrawal, user] = await Promise.all([
    Withdrawal.findById(withdrawalId),
    User.findById(input.userId).select("wallet")
  ]);
  if (!withdrawal || !user) {
    throw new ApiError(500, "withdrawal_result_unavailable", "Withdrawal result is unavailable");
  }
  return {
    withdrawal,
    wallet: serializeWallet(user.wallet),
    idempotentReplay: false
  };
}
