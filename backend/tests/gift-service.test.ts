import mongoose, { Types, type ClientSession } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const giftMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn()
}));
const attemptMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn()
}));
const gameMocks = vi.hoisted(() => ({
  findActiveGameByKey: vi.fn()
}));

vi.mock("../src/models/GiftItem.js", () => ({ GiftItem: giftMocks }));
vi.mock("../src/models/ChallengeAttempt.js", () => ({ ChallengeAttempt: attemptMocks }));
vi.mock("../src/services/game.service.js", () => gameMocks);

import { useGift } from "../src/services/gift.service.js";

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
    giftMocks.findOne.mockReset();
    giftMocks.findOneAndUpdate.mockReset();
    attemptMocks.findOne.mockReset();
    attemptMocks.updateOne.mockReset();
    gameMocks.findActiveGameByKey.mockResolvedValue({ _id: gameId, key: "tetris" });
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
});
