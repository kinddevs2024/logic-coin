import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose, { Types } from "mongoose";
import { HomeGiftState } from "../src/models/HomeGiftState.js";
import { RewardedAdSession } from "../src/models/RewardedAdSession.js";
import { ChallengeAdReward } from "../src/models/ChallengeAdReward.js";
import { DailyChallengeSet } from "../src/models/DailyChallengeSet.js";
import { claimHomeGiftAds, finishHomeGiftTelegramLink, isTelegramMember } from "../src/services/home-gift.service.js";
import { TelegramLoginChallenge } from "../src/models/TelegramLoginChallenge.js";

describe("home gift guards", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("only accepts actual Telegram membership", () => {
    for (const status of ["member", "administrator", "creator"]) expect(isTelegramMember({ status })).toBe(true);
    for (const status of ["left", "kicked", "restricted", "unknown"]) expect(isTelegramMember({ status })).toBe(false);
    expect(isTelegramMember({ status: "restricted", is_member: true })).toBe(true);
  });
  it("cannot link another user's or expired flow", async () => {
    const userId = new Types.ObjectId();
    const find = vi.spyOn(TelegramLoginChallenge, "findOne").mockReturnValue({ select: async () => null } as never);
    await expect(finishHomeGiftTelegramLink(userId, "flow", "secret")).rejects.toThrow();
    expect(find.mock.calls[0]?.[0]).toMatchObject({ linkUserId: userId, expiresAt: { $gt: expect.any(Date) } });
  });
  it("requires two owned verified receipts, not one", async () => {
    const userId = new Types.ObjectId();
    const state = { cycleId: "cycle", cycleDayKey: "2026-10-08", cycleExpiresAt: new Date(Date.now() + 60000), availableAt: new Date(0) };
    vi.spyOn(mongoose, "startSession").mockResolvedValue({ withTransaction: async (callback: () => Promise<void>) => callback(), endSession: async () => {} } as never);
    vi.spyOn(HomeGiftState, "findOne").mockReturnValue({ session: async () => state } as never);
    vi.spyOn(DailyChallengeSet, "findOne").mockReturnValue({ session: async () => ({ dayKey: state.cycleDayKey }) } as never);
    const find = vi.spyOn(RewardedAdSession, "find").mockReturnValue({ sort: () => ({ limit: () => ({ session: async () => [{ _id: new Types.ObjectId() }] }) }) } as never);
    const credit = vi.spyOn(ChallengeAdReward, "create");
    await expect(claimHomeGiftAds(userId, "cycle")).rejects.toThrow("две рекламы");
    expect((find.mock.calls as unknown[][])[0]?.[0]).toMatchObject({ userId, placement: "home-gift", homeGiftCycleId: "cycle", status: "completed" });
    expect(credit).not.toHaveBeenCalled();
  });
  it("does not credit a previously claimed cycle again", async () => {
    vi.spyOn(mongoose, "startSession").mockResolvedValue({ withTransaction: async (callback: () => Promise<void>) => callback(), endSession: async () => {} } as never);
    vi.spyOn(HomeGiftState, "findOne").mockReturnValue({ session: async () => ({ lastClaimedCycle: "same" }) } as never);
    const credit = vi.spyOn(ChallengeAdReward, "create");
    expect(await claimHomeGiftAds(new Types.ObjectId(), "same")).toEqual({ credited: 0, alreadyClaimed: true });
    expect(credit).not.toHaveBeenCalled();
  });
});
