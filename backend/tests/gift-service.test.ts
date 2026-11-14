import mongoose, { Types, type ClientSession } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const giftMocks = vi.hoisted(() => ({
  find: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn()
}));
const attemptMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn()
}));
const gameMocks = vi.hoisted(() => ({
  findActiveGameByKey: vi.fn()
}));
const coinMocks = vi.hoisted(() => ({
  creditCoins: vi.fn()
}));

vi.mock("../src/models/GiftItem.js", () => ({ GiftItem: giftMocks }));
vi.mock("../src/models/ChallengeAttempt.js", () => ({ ChallengeAttempt: attemptMocks }));
vi.mock("../src/services/game.service.js", () => gameMocks);
vi.mock("../src/services/coin.service.js", () => coinMocks);

import { activateNextChallengeCoinGifts, useGift } from "../src/services/gift.service.js";

const userId = new Types.ObjectId();
const gameId = new Types.ObjectId();
const giftId = new Types.ObjectId().toString();
const attemptId = new Types.ObjectId();
const gift = {
  _id: new Types.ObjectId(),
  kind: "time_extension",
  amountSeconds: 60,
  status: "used",
  description: "Extra time",
  usedAt: new Date("2026-08-20T10:00:00.000Z"),
  usedOnGameKey: "tetris",
  createdAt: new Date("2026-08-20T09:00:00.000Z")
};

function activeAttempt(value: { _id: Types.ObjectId } | null) {
  attemptMocks.findOne.mockReturnValue({
    select: vi.fn().mockReturnValue({
      session: vi.fn().mockResolvedValue(value)
    })
  });
}

describe("gift use transaction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    giftMocks.find.mockReset();
    giftMocks.findOne.mockReset();
    giftMocks.findOneAndUpdate.mockReset();
    giftMocks.updateOne.mockReset();
    attemptMocks.findOne.mockReset();
    attemptMocks.updateOne.mockReset();
    gameMocks.findActiveGameByKey.mockResolvedValue({ _id: gameId, key: "tetris" });
    coinMocks.creditCoins.mockReset();
    coinMocks.creditCoins.mockResolvedValue({ balanceAfter: 500, idempotentReplay: false });
    giftMocks.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ ...gift, status: "available" })
    });

    const session = {
      withTransaction: vi.fn(async (work: () => Promise<void>) => work()),
      endSession: vi.fn().mockResolvedValue(undefined)
    } as unknown as ClientSession;
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
  });

  it("does not consume a gift when no started attempt exists", async () => {
    activeAttempt(null);

    await expect(useGift({ userId, giftId, gameKey: "tetris" })).rejects.toMatchObject({
      statusCode: 409,
      code: "active_attempt_required"
    });
    expect(giftMocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("does not let a next-challenge coin bonus be redeemed manually", async () => {
    giftMocks.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        ...gift,
        kind: "coin",
        coinAmount: 500,
        status: "available",
        activationMode: "next_challenge",
        sourceDayKey: "2026-08-24"
      })
    });

    await expect(useGift({ userId, giftId })).rejects.toMatchObject({
      statusCode: 409,
      code: "gift_activates_next_challenge"
    });
    expect(coinMocks.creditCoins).not.toHaveBeenCalled();
    expect(giftMocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("aborts the transaction when the started attempt ends during gift consumption", async () => {
    activeAttempt({ _id: attemptId });
    giftMocks.findOneAndUpdate.mockResolvedValue(gift);
    attemptMocks.updateOne.mockResolvedValue({ matchedCount: 0 });

    await expect(useGift({ userId, giftId, gameKey: "tetris" })).rejects.toMatchObject({
      statusCode: 409,
      code: "active_attempt_required"
    });
    expect(attemptMocks.updateOne).toHaveBeenCalledWith(
      { _id: attemptId, status: "started" },
      { $inc: { "metadata.extraTimeSecondsGranted": 60 } },
      expect.objectContaining({ session: expect.anything() })
    );
  });

  it("consumes a gift only after exactly one active attempt is updated", async () => {
    activeAttempt({ _id: attemptId });
    giftMocks.findOneAndUpdate.mockResolvedValue(gift);
    attemptMocks.updateOne.mockResolvedValue({ matchedCount: 1 });

    const result = await useGift({ userId, giftId, gameKey: "tetris" });

    expect(result.gift.status).toBe("used");
    expect(result.effect).toEqual({ kind: "time_extension", additionalTimeSeconds: 60 });
  });

  it("activates pending contest coins in the next challenge exactly once", async () => {
    const pending = [
      { _id: new Types.ObjectId(), coinAmount: 500, sourceDayKey: "2026-08-23" },
      { _id: new Types.ObjectId(), coinAmount: 600, sourceDayKey: "2026-08-24" }
    ];
    giftMocks.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        session: vi.fn().mockResolvedValue(pending)
      })
    });
    giftMocks.updateOne.mockResolvedValue({ matchedCount: 1 });

    const credited = await activateNextChallengeCoinGifts({
      userId,
      dayKey: "2026-08-25"
    });

    expect(credited).toBe(1_100);
    expect(coinMocks.creditCoins).toHaveBeenCalledTimes(2);
    expect(coinMocks.creditCoins).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 500,
        type: "challenge_coin_reward",
        metadata: expect.objectContaining({ dayKey: "2026-08-25", kind: "starting_bonus" })
      }),
      expect.anything()
    );
    expect(giftMocks.updateOne).toHaveBeenCalledTimes(2);
  });
});
