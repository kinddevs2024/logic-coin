import bcrypt from "bcryptjs";
import type { Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { generateRegistrationToken, hashOpaqueToken } from "../lib/crypto.js";
import { User } from "../models/User.js";
import { PasswordSetupChallenge } from "../models/PasswordSetupChallenge.js";
import { assertDeviceAccess } from "./device-security.service.js";
import { serializeUser } from "./serialization.service.js";
import { issueTokenPair, type SessionContext } from "./token.service.js";

export async function completeSocialSignIn(userId: Types.ObjectId, context: SessionContext) {
  // Provider services may return a document whose passwordHash was not selected.
  const user = await User.findById(userId).select("+passwordHash");
  if (!user?.emailVerifiedAt) throw new ApiError(401, "account_unavailable", "Account is unavailable");
  await assertDeviceAccess(userId, context.deviceId);
  // Installed clients before the password-setup update require user/tokens.
  // Negotiate the new response only after successful provider verification;
  // a capability header is not an authentication proof or a device exemption.
  if (user.passwordHash || !context.supportsPasswordSetup) {
    return { user: serializeUser(user), tokens: await issueTokenPair(userId, context) };
  }
  const setupToken = generateRegistrationToken();
  await PasswordSetupChallenge.create({
    userId,
    tokenHash: hashOpaqueToken(setupToken),
    ...(context.deviceId ? { deviceId: context.deviceId } : {}),
    expiresAt: new Date(Date.now() + 15 * 60_000)
  });
  return {
    status: "password_setup_required" as const,
    setupToken,
    accountLabel: user.username ? `@${user.username}` : user.providers?.telegramSub ? user.name : user.email
  };
}

export async function setSocialPassword(password: string, setupToken: string, context: SessionContext) {
  const challenge = await PasswordSetupChallenge.findOne({
    tokenHash: hashOpaqueToken(setupToken), expiresAt: { $gt: new Date() }
  });
  if (!challenge || (challenge.deviceId && challenge.deviceId !== context.deviceId)) {
    throw new ApiError(400, "invalid_password_setup", "Password setup has expired. Sign in again.");
  }
  await assertDeviceAccess(challenge.userId, context.deviceId);
  const passwordHash = await bcrypt.hash(password, 12);
  // Atomically create only a missing password. Replayed or concurrent proofs
  // cannot replace a password, even when poll and resume both completed.
  const user = await User.findOneAndUpdate({
    _id: challenge.userId,
    emailVerifiedAt: { $exists: true },
    passwordHash: { $in: [null, ""] }
  }, { $set: { passwordHash, lastLoginAt: new Date() } }, { new: true });
  if (!user) throw new ApiError(400, "invalid_password_setup", "Password setup has expired. Sign in again.");
  await PasswordSetupChallenge.deleteMany({ userId: user._id });
  return { user: serializeUser(user), tokens: await issueTokenPair(user._id, context) };
}
