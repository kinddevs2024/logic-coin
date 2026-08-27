import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { generateOtp, hashOtp, normalizeEmail, otpMatches } from "../lib/crypto.js";
import { OtpChallenge } from "../models/OtpChallenge.js";
import { sendVerificationCode } from "./email.service.js";

export async function createAndSendOtp(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const dailyWindowStart = new Date(Date.now() - 24 * 60 * 60_000);
  const sentToday = await OtpChallenge.countDocuments({
    email,
    purpose: "verify_email",
    sentAt: { $gte: dailyWindowStart }
  });
  if (sentToday >= 3) {
    const firstInWindow = await OtpChallenge.findOne({
      email,
      purpose: "verify_email",
      sentAt: { $gte: dailyWindowStart }
    }).sort({ sentAt: 1 });
    const retryAfterSeconds = Math.max(
      60,
      Math.ceil(((firstInWindow?.sentAt.getTime() ?? Date.now()) + 24 * 60 * 60_000 - Date.now()) / 1_000)
    );
    throw new ApiError(429, "otp_daily_limit", "No more than three verification emails are allowed per day", {
      retryAfterSeconds,
      sendsRemaining: 0
    });
  }
  const latest = await OtpChallenge.findOne({ email, purpose: "verify_email" }).sort({ createdAt: -1 });
  if (latest && Date.now() - latest.sentAt.getTime() < 60_000) {
    const retryAfterSeconds = Math.ceil((60_000 - (Date.now() - latest.sentAt.getTime())) / 1_000);
    throw new ApiError(429, "otp_cooldown", "Please wait before requesting another code", {
      retryAfterSeconds
    });
  }

  const code = generateOtp();
  const now = new Date();
  const challenge = await OtpChallenge.create({
    email,
    purpose: "verify_email",
    codeHash: hashOtp(email, code),
    attempts: 0,
    sentAt: now,
    expiresAt: new Date(now.getTime() + env.OTP_TTL_MINUTES * 60_000)
  });

  let delivery: "sent" | "disabled";
  try {
    delivery = await sendVerificationCode(email, code);
  } catch (error) {
    await OtpChallenge.deleteOne({ _id: challenge._id });
    throw error;
  }
  await OtpChallenge.updateMany(
    {
      _id: { $ne: challenge._id },
      email,
      purpose: "verify_email",
      consumedAt: { $exists: false }
    },
    { $set: { consumedAt: new Date() } }
  );
  return {
    delivery,
    expiresInSeconds: env.OTP_TTL_MINUTES * 60,
    resendAvailableInSeconds: 60,
    sendsRemaining: Math.max(0, 2 - sentToday),
    ...(env.OTP_EXPOSE_CODE && env.NODE_ENV !== "production" ? { devOtp: code } : {})
  };
}

export async function consumeOtp(emailInput: string, code: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const activeFilter = {
    email,
    purpose: "verify_email" as const,
    consumedAt: { $exists: false },
    expiresAt: { $gt: new Date() }
  };
  // Reserve an attempt atomically. A read/check/save sequence lets parallel
  // requests all observe the same counter and bypass the five-attempt limit.
  const challenge = await OtpChallenge.findOneAndUpdate(
    { ...activeFilter, attempts: { $lt: 5 } },
    { $inc: { attempts: 1 } },
    { new: true, sort: { createdAt: -1 } }
  );

  if (!challenge) {
    const exhausted = await OtpChallenge.exists({
      ...activeFilter,
      attempts: { $gte: 5 }
    });
    if (exhausted) {
      throw new ApiError(429, "otp_attempts_exceeded", "Too many verification attempts");
    }
    throw new ApiError(400, "otp_expired", "Verification code is expired or unavailable");
  }
  if (!otpMatches(email, code, challenge.codeHash)) {
    throw new ApiError(400, "invalid_otp", "Verification code is incorrect", {
      attemptsRemaining: Math.max(0, 5 - challenge.attempts)
    });
  }

  const consumed = await OtpChallenge.updateOne(
    { _id: challenge._id, consumedAt: { $exists: false } },
    { $set: { consumedAt: new Date() } }
  );
  if (consumed.modifiedCount !== 1) {
    throw new ApiError(400, "otp_expired", "Verification code is expired or unavailable");
  }
}
