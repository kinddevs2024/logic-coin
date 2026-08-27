import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { consumeRewardedAdSession } from "./rewarded-ad-session.service.js";

export type RewardedAdProof = {
  provider?: "demo" | "appodeal";
  receiptId?: string;
};

/**
 * Integration boundary for rewarded video verification. Demo is deliberately
 * explicit in the response. AppLovin MAX server-to-server verification can be
 * added here without changing the challenge route contract.
 */
export async function verifyRewardedAd(proof: RewardedAdProof | undefined, userId: Types.ObjectId) {
  const provider = proof?.provider ?? "demo";
  if (provider === "appodeal") {
    if (!proof?.receiptId) {
      throw new ApiError(400, "rewarded_ad_receipt_required", "Rewarded ad receipt is required");
    }
    const session = await consumeRewardedAdSession({
      userId,
      sessionId: proof.receiptId,
      placements: ["challenge-first-game", "challenge-day-complete"]
    });
    return {
      provider,
      receiptId: session.sessionId,
      verified: true,
      placeholder: false
    } as const;
  }
  if (env.NODE_ENV === "production") {
    throw new ApiError(
      409,
      "demo_rewarded_ads_disabled",
      "Demo rewarded ads are disabled in production"
    );
  }
  return {
    provider,
    receiptId: proof?.receiptId?.trim() || `demo-${randomUUID()}`,
    verified: true,
    placeholder: true
  } as const;
}
