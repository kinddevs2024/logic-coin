import { adsApi } from "@/lib/api";
import {
  rewardedAds,
  type RewardedAdPlacement,
  type RewardedAdReceipt,
} from "@/lib/rewarded-ad";

const S2S_POLL_DELAYS_MS = [350, 700, 1_200, 2_000, 3_000];

function pause(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export type VerifiedRewardedAdResult = {
  receipt: RewardedAdReceipt;
  sessionId: string | null;
  verified: boolean;
  credited: number;
  coinBalance?: number;
};

export async function showVerifiedRewardedAd(input: {
  placement: RewardedAdPlacement;
  accessToken?: string | null;
  claimCoins?: boolean;
}): Promise<VerifiedRewardedAdResult> {
  const session = input.accessToken
    ? await adsApi.startRewarded(input.placement, input.accessToken)
    : null;
  const receipt = await rewardedAds.show(input.placement);
  if (!receipt.completed) {
    return { receipt, sessionId: session?.sessionId ?? null, verified: false, credited: 0 };
  }
  if (!session || !input.accessToken) {
    return { receipt, sessionId: null, verified: true, credited: 0 };
  }

  let status = await adsApi.completeRewarded(
    session.sessionId,
    receipt.proof,
    input.accessToken,
  );
  for (const delay of S2S_POLL_DELAYS_MS) {
    if (status.status === "completed" || status.status === "claimed") break;
    await pause(delay);
    status = await adsApi.status(session.sessionId, input.accessToken);
  }
  if (status.status !== "completed" && status.status !== "claimed") {
    return { receipt, sessionId: session.sessionId, verified: false, credited: 0 };
  }
  if (!input.claimCoins) {
    return { receipt, sessionId: session.sessionId, verified: true, credited: 0 };
  }
  const claimed = await adsApi.claim(session.sessionId, input.accessToken);
  return {
    receipt,
    sessionId: session.sessionId,
    verified: true,
    credited: claimed.credited,
    coinBalance: claimed.coins.balance,
  };
}
