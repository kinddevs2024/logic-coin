import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function opaqueTokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOpaqueToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashOtp(email: string, code: string): string {
  return createHmac("sha256", env.OTP_PEPPER)
    .update(`${normalizeEmail(email)}:${code}`)
    .digest("hex");
}

export function otpMatches(email: string, code: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(email, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function generateRegistrationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generatePkceVerifier(): string {
  return randomBytes(48).toString("base64url");
}

export function pkceS256Challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function hashOAuthBinding(
  provider: string,
  context: { deviceId?: string; userAgent?: string }
): string | null {
  const deviceId = context.deviceId?.trim();
  const userAgent = context.userAgent?.trim();
  const binding = deviceId ? `device:${deviceId}` : userAgent ? `user-agent:${userAgent}` : null;
  if (!binding) {
    return null;
  }
  return createHmac("sha256", env.JWT_SECRET)
    .update(`${provider}:${binding}`)
    .digest("hex");
}

export function generateReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let result = "LC";
  for (const byte of bytes) {
    result += alphabet[byte % alphabet.length];
  }
  return result;
}

export function generateIdempotencyKey(): string {
  return randomBytes(18).toString("base64url");
}
