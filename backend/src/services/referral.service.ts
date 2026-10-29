import mongoose, { Types } from "mongoose";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { LedgerEntry } from "../models/LedgerEntry.js";
import { User, type UserDocument } from "../models/User.js";
import { unitsToCents } from "../lib/money.js";
import { listAvatarUrl } from "../lib/list-avatar.js";
import { processReferralSignupReward } from "./user.service.js";
import {
  REFERRAL_DIRECT_PRIZE_SHARE_PERCENT,
  REFERRAL_SECOND_LEVEL_PRIZE_SHARE_PERCENT
} from "../config/constants.js";

export async function getReferralOverview(userId: Types.ObjectId, account?: Pick<UserDocument, "referralCode" | "wallet">, page = { offset: 0, limit: 6 }) {
  const user = account ?? await User.findById(userId).select(
    "referralCode wallet.referralEarnedUnits coins.referralEarned"
  );
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  const [friends, history, invitedCount, verifiedInvitedCount] = await Promise.all([
    User.find({ referredBy: userId })
      .select("name avatarUrl emailVerifiedAt createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip(page.offset)
      .limit(page.limit)
      .lean(),
    LedgerEntry.find({ userId, type: "referral_bonus" })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    User.countDocuments({ referredBy: userId }),
    User.countDocuments({ referredBy: userId, emailVerifiedAt: { $ne: null } }),
  ]);
  const earnedUnits = user.wallet.referralEarnedUnits;

  return {
    code: user.referralCode,
    link: `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/invite/${encodeURIComponent(user.referralCode)}`,
    invitedCount,
    verifiedInvitedCount,
    nextOffset: page.offset + friends.length < invitedCount ? page.offset + friends.length : null,
    earnedUnits,
    earnedCents: unitsToCents(earnedUnits),
    signupRewardUnits: 0,
    friends: friends.map((friend) => ({
      id: friend._id.toString(),
      name: friend.name,
      avatarUrl: listAvatarUrl(friend._id, friend.avatarUrl),
      verified: Boolean(friend.emailVerifiedAt),
      joinedAt: friend.createdAt
    })),
    history: history.map((entry) => ({
      id: entry._id.toString(),
      amountUnits: entry.amountUnits,
      amountCents: unitsToCents(entry.amountUnits),
      createdAt: entry.createdAt
    })),
  };
}

export async function applyReferralCode(userId: Types.ObjectId, referralCode: string) {
  const inviter = await User.findOne({
    referralCode: referralCode.trim().toUpperCase(),
    _id: { $ne: userId }
  }).select("_id");
  if (!inviter) {
    throw new ApiError(404, "referral_code_not_found", "Referral code was not found");
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findOneAndUpdate(
        {
          _id: userId,
          referredBy: { $exists: false },
          referralRewardProcessedAt: { $exists: false }
        },
        { $set: { referredBy: inviter._id } },
        { new: true, session }
      );
      if (!user) {
        throw new ApiError(409, "referral_already_applied", "A referral code is already applied");
      }
      await processReferralSignupReward(user._id, session);
    });
  } finally {
    await session.endSession();
  }
}

export function calculateReferralPrizeShare(amount: number, percent = REFERRAL_DIRECT_PRIZE_SHARE_PERCENT): number {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new ApiError(500, "invalid_referral_prize", "Referral prize must be a non-negative integer");
  }
  return Math.floor((amount * percent) / 100);
}

export async function creditReferralCashPrizeShare(
  input: {
    winnerUserId: Types.ObjectId;
    winnerPrizeUnits: number;
    dayKey: string;
    sourceId: string;
  },
  session: mongoose.ClientSession
) {
  const winner = await User.findById(input.winnerUserId).select("referredBy").session(session);
  if (!winner?.referredBy) return { credited: 0 };
  const directAmountUnits = calculateReferralPrizeShare(
    input.winnerPrizeUnits,
    REFERRAL_DIRECT_PRIZE_SHARE_PERCENT
  );
  const directInviter = await User.findById(winner.referredBy).select("referredBy").session(session);
  const { creditReward } = await import("./wallet.service.js");
  if (directAmountUnits > 0) {
    await creditReward({
      userId: winner.referredBy,
      amountUnits: directAmountUnits,
      type: "referral_bonus",
      sourceId: `cash-share:direct:${input.sourceId}`,
      description: `15% referral share from daily contest (${input.dayKey})`,
      dayKey: input.dayKey,
      referralReward: true,
      metadata: { dayKey: input.dayKey, originUserId: input.winnerUserId.toString(), originType: "contest_cash_prize", level: 1, sharePercent: REFERRAL_DIRECT_PRIZE_SHARE_PERCENT }
    }, session);
  }
  const secondLevelAmountUnits = calculateReferralPrizeShare(
    input.winnerPrizeUnits,
    REFERRAL_SECOND_LEVEL_PRIZE_SHARE_PERCENT
  );
  if (directInviter?.referredBy && secondLevelAmountUnits > 0) {
    await creditReward({
      userId: directInviter.referredBy,
      amountUnits: secondLevelAmountUnits,
      type: "referral_bonus",
      sourceId: `cash-share:second-level:${input.sourceId}`,
      description: `5% second-level referral share from daily contest (${input.dayKey})`,
      dayKey: input.dayKey,
      referralReward: true,
      metadata: { dayKey: input.dayKey, originUserId: input.winnerUserId.toString(), originType: "contest_cash_prize", level: 2, sharePercent: REFERRAL_SECOND_LEVEL_PRIZE_SHARE_PERCENT }
    }, session);
  }
  return { credited: directAmountUnits + (directInviter?.referredBy ? secondLevelAmountUnits : 0) };
}
