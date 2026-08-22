import mongoose, { Types } from "mongoose";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { LedgerEntry } from "../models/LedgerEntry.js";
import { CoinLedgerEntry } from "../models/CoinLedgerEntry.js";
import { User } from "../models/User.js";
import { unitsToCents } from "../lib/money.js";
import { processReferralSignupReward } from "./user.service.js";
import { REFERRAL_PRIZE_SHARE_PERCENT } from "../config/constants.js";

export async function getReferralOverview(userId: Types.ObjectId) {
  const user = await User.findById(userId).select(
    "referralCode wallet.referralEarnedUnits coins.referralEarned"
  );
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  const [friends, history, coinHistory] = await Promise.all([
    User.find({ referredBy: userId })
      .select("name avatarUrl emailVerifiedAt createdAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    LedgerEntry.find({ userId, type: "referral_bonus" })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    CoinLedgerEntry.find({ userId, type: "referral_coin_bonus" })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
  ]);
  const earnedUnits = user.wallet.referralEarnedUnits;

  return {
    code: user.referralCode,
    link: `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/?ref=${encodeURIComponent(user.referralCode)}`,
    invitedCount: friends.length,
    verifiedInvitedCount: friends.filter((friend) => Boolean(friend.emailVerifiedAt)).length,
    earnedUnits,
    earnedCents: unitsToCents(earnedUnits),
    earnedCoins: user.coins?.referralEarned ?? 0,
    signupRewardUnits: env.REFERRAL_SIGNUP_REWARD_UNITS,
    friends: friends.map((friend) => ({
      id: friend._id.toString(),
      name: friend.name,
      avatarUrl: friend.avatarUrl ?? null,
      verified: Boolean(friend.emailVerifiedAt),
      joinedAt: friend.createdAt
    })),
    history: history.map((entry) => ({
      id: entry._id.toString(),
      amountUnits: entry.amountUnits,
      amountCents: unitsToCents(entry.amountUnits),
      createdAt: entry.createdAt
    })),
    coinHistory: coinHistory.map((entry) => ({
      id: entry._id.toString(),
      amount: entry.amount,
      createdAt: entry.createdAt
    }))
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
      if (user.emailVerifiedAt) {
        await processReferralSignupReward(user._id, session);
      }
    });
  } finally {
    await session.endSession();
  }
}

export function calculateReferralPrizeShare(amount: number): number {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new ApiError(500, "invalid_referral_prize", "Referral prize must be a non-negative integer");
  }
  return Math.floor((amount * REFERRAL_PRIZE_SHARE_PERCENT) / 100);
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
  const amountUnits = calculateReferralPrizeShare(input.winnerPrizeUnits);
  if (!winner?.referredBy || amountUnits <= 0) return { credited: 0 };
  const { creditReward } = await import("./wallet.service.js");
  await creditReward(
    {
      userId: winner.referredBy,
      amountUnits,
      type: "referral_bonus",
      sourceId: `cash-share:${input.sourceId}`,
      description: `25% referral share from daily contest (${input.dayKey})`,
      dayKey: input.dayKey,
      referralReward: true,
      metadata: {
        dayKey: input.dayKey,
        originUserId: input.winnerUserId.toString(),
        originType: "contest_cash_prize",
        sharePercent: REFERRAL_PRIZE_SHARE_PERCENT
      }
    },
    session
  );
  return { credited: amountUnits };
}

export async function creditReferralCoinPrizeShare(
  input: {
    winnerUserId: Types.ObjectId;
    winnerPrizeCoins: number;
    dayKey: string;
    sourceId: string;
  },
  session: mongoose.ClientSession
) {
  const winner = await User.findById(input.winnerUserId).select("referredBy").session(session);
  const amount = calculateReferralPrizeShare(input.winnerPrizeCoins);
  if (!winner?.referredBy || amount <= 0) return { credited: 0 };
  const { creditCoins } = await import("./coin.service.js");
  await creditCoins(
    {
      userId: winner.referredBy,
      amount,
      type: "referral_coin_bonus",
      sourceId: `coin-share:${input.sourceId}`,
      description: `25% referral coin share (${input.dayKey})`,
      referralReward: true,
      metadata: {
        dayKey: input.dayKey,
        originUserId: input.winnerUserId.toString(),
        originType: "daily_consolation",
        sharePercent: REFERRAL_PRIZE_SHARE_PERCENT
      }
    },
    session
  );
  return { credited: amount };
}
