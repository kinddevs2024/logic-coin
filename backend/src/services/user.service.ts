import type { ClientSession, Types } from "mongoose";
import { User } from "../models/User.js";
import { generateReferralCode, normalizeEmail } from "../lib/crypto.js";
import { ApiError } from "../lib/api-error.js";
import { env } from "../config/env.js";

interface CreateUserInput {
  email: string;
  name: string;
  passwordHash?: string;
  registrationTokenHash?: string;
  registrationTokenExpiresAt?: Date;
  emailVerifiedAt?: Date;
  googleSub?: string;
  yandexSub?: string;
  telegramSub?: string;
  referralCode?: string;
  countryCode?: string;
}

export async function createUser(input: CreateUserInput) {
  const normalizedEmail = normalizeEmail(input.email);
  let referredBy: Types.ObjectId | undefined;
  if (input.referralCode) {
    const inviter = await User.findOne({
      referralCode: input.referralCode.trim().toUpperCase()
    }).select("_id");
    referredBy = inviter?._id;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await User.create({
        email: normalizedEmail,
        role: env.ADMIN_EMAILS.includes(normalizedEmail) ? "admin" : "user",
        name: input.name.trim(),
        ...(input.countryCode ? { countryCode: input.countryCode.toUpperCase() } : {}),
        ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}),
        ...(input.registrationTokenHash
          ? { registrationTokenHash: input.registrationTokenHash }
          : {}),
        ...(input.registrationTokenExpiresAt
          ? { registrationTokenExpiresAt: input.registrationTokenExpiresAt }
          : {}),
        ...(input.emailVerifiedAt ? { emailVerifiedAt: input.emailVerifiedAt } : {}),
        providers: {
          ...(input.googleSub ? { googleSub: input.googleSub } : {}),
          ...(input.yandexSub ? { yandexSub: input.yandexSub } : {}),
          ...(input.telegramSub ? { telegramSub: input.telegramSub } : {})
        },
        referralCode: generateReferralCode(),
        ...(referredBy ? { referredBy } : {})
      });
    } catch (error) {
      const mongoError = error as { code?: number; keyPattern?: Record<string, number> };
      if (mongoError.code === 11_000 && mongoError.keyPattern?.referralCode) {
        continue;
      }
      throw error;
    }
  }

  throw new ApiError(503, "referral_code_unavailable", "Could not allocate a referral code");
}

export async function processReferralSignupReward(
  userId: Types.ObjectId,
  session: ClientSession
): Promise<void> {
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      referredBy: { $exists: true },
      referralRewardProcessedAt: { $exists: false }
    },
    { $set: { referralRewardProcessedAt: new Date() } },
    { new: true, session }
  ).select("referredBy");

  if (!user?.referredBy) {
    return;
  }

  if (env.REFERRAL_SIGNUP_REWARD_UNITS === 0) {
    return;
  }

  const { creditReward } = await import("./wallet.service.js");
  await creditReward(
    {
      userId: user.referredBy,
      amountUnits: env.REFERRAL_SIGNUP_REWARD_UNITS,
      type: "referral_bonus",
      sourceId: userId.toString(),
      description: "Verified friend referral",
      referralReward: true
    },
    session
  );
}
