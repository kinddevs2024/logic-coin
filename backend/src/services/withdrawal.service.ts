import {encryptPayoutCard,decryptPayoutCard,validPayoutCard} from "../lib/payout-card.js";
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
    brand: "visa" | "mastercard" | "uzcard" | "humo" | "other";
    last4: string;
    number?: string;
    savedWithdrawalId?: string;
    holderName?: string;
    expiration?: string;
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

  let number=input.card.number;
  if(!number && input.card.savedWithdrawalId){
    const saved=await Withdrawal.findOne({_id:input.card.savedWithdrawalId,userId:input.userId}).select("+cardNumberEncrypted");
    if(!saved?.cardNumberEncrypted)throw new ApiError(400,"card_number_required","Введите полный номер карты заново.");
    number=decryptPayoutCard(saved.cardNumberEncrypted,`${input.userId}:${saved.idempotencyKey}`);
  }
  if(number && (!validPayoutCard(number)||number.slice(-4)!==input.card.last4))throw new ApiError(400,"invalid_card_number","Проверьте номер карты.");
  const encrypted=number?encryptPayoutCard(number,`${input.userId}:${input.idempotencyKey}`):undefined;
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
            ...(encrypted ? {cardNumberEncrypted:encrypted}:{}),
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

export async function addWithdrawalCard(userId:Types.ObjectId,id:string,number:string){
 const row=await Withdrawal.findOne({_id:id,userId,status:"pending_review"});
 if(!row)throw new ApiError(409,"withdrawal_not_editable","Можно дополнить только свою заявку, которая ещё на проверке.");
 if(!validPayoutCard(number)||number.slice(-4)!==row.cardLast4)throw new ApiError(400,"invalid_card_number","Введите полный номер той же карты, которая указана в заявке.");
 const encrypted=encryptPayoutCard(number,`${userId}:${row.idempotencyKey}`);
 const updated=await Withdrawal.updateOne({_id:row._id,userId,status:"pending_review",reviewVersion:row.reviewVersion??0},{$set:{cardNumberEncrypted:encrypted},$inc:{reviewVersion:1}});
 if(!updated.modifiedCount)throw new ApiError(409,"withdrawal_changed","Заявка изменилась. Обновите страницу.");
 return {ok:true};
}
