import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { RewardedAdSession } from "../models/RewardedAdSession.js";
export const MONETAG_ZONE = "12150927";
export function hasValidMonetagSecret(value: unknown): boolean {
  const secret = env.MONETAG_POSTBACK_SECRET;
  return Boolean(secret && typeof value === "string" && value.length <= 128 && timingSafeEqual(
    createHash("sha256").update(value).digest(), createHash("sha256").update(secret).digest(),
  ));
}

// Both delivery orders are valid. A paid impression alone is not a completed
// UI flow, and a client receipt alone is never proof of an ad impression.
export function completeMonetagSessionIfReady(sessionId: string) {
  return RewardedAdSession.findOneAndUpdate({
    sessionId, provider: "monetag", status: "started", expiresAt: { $gt: new Date() },
    clientReceiptId: { $type: "string" }, monetagValuedAt: { $type: "date" },
  }, { $set: { status: "completed", completedAt: new Date() } }, { new: true });
}

export async function verifyMonetagPostback(input: {
  secret: string; ymid: string; zone_id: string;
  event_type: "impression" | "click"; reward_event_type: "valued" | "non_valued";
}) {
  if (!hasValidMonetagSecret(input.secret)) {
    throw new ApiError(403, "invalid_monetag_secret", "Invalid postback credential");
  }
  if (input.zone_id !== MONETAG_ZONE) throw new ApiError(400, "invalid_monetag_zone", "Invalid Monetag zone");
  if (input.reward_event_type !== "valued" || !/^[a-f0-9-]{36}$/i.test(input.ymid)) return { accepted: false };
  const session = await RewardedAdSession.findOneAndUpdate({
    sessionId: input.ymid, provider: "monetag", status: "started", expiresAt: { $gt: new Date() },
  }, { $set: { monetagValuedAt: new Date() } }, { new: true });
  if (!session) return { accepted: false };
  await completeMonetagSessionIfReady(session.sessionId);
  return { accepted: true };
}
