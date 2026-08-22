import { randomUUID } from "node:crypto";
import { ApiError } from "../lib/api-error.js";

export type RewardedAdProof = {
  provider?: "demo" | "applovin-max";
  receiptId?: string;
};

/**
 * Integration boundary for rewarded video verification. Demo is deliberately
 * explicit in the response. AppLovin MAX server-to-server verification can be
 * added here without changing the challenge route contract.
 */
export async function verifyRewardedAd(proof?: RewardedAdProof) {
  const provider = proof?.provider ?? "demo";
  if (provider !== "demo") {
    throw new ApiError(
      501,
      "rewarded_ad_provider_not_configured",
      "Rewarded ad verification is not configured for this provider"
    );
  }
  return {
    provider,
    receiptId: proof?.receiptId?.trim() || `demo-${randomUUID()}`,
    verified: true,
    placeholder: true
  } as const;
}
