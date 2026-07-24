import mongoose, { Types } from "mongoose";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { LedgerEntry } from "../models/LedgerEntry.js";
import { User } from "../models/User.js";
import { unitsToCents } from "../lib/money.js";
import { processReferralSignupReward } from "./user.service.js";

export async function getReferralOverview(userId: Types.ObjectId) {
  const user = await User.findById(userId).select("referralCode wallet.referralEarnedUnits");
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  const [friends, history] = await Promise.all([
    User.find({ referredBy: userId })
      .select("name avatarUrl emailVerifiedAt createdAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    LedgerEntry.find({ userId, type: "referral_bonus" })
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
