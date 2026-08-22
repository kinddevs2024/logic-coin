import mongoose, { Types, type ClientSession } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attemptCreate: vi.fn(),
  userFindById: vi.fn(),
  creditCoins: vi.fn(),
  findActiveGameByKey: vi.fn()
}));

vi.mock("../src/models/ChallengeAttempt.js", () => ({
  ChallengeAttempt: { create: mocks.attemptCreate }
}));
vi.mock("../src/models/User.js", () => ({ User: { findById: mocks.userFindById } }));
vi.mock("../src/services/coin.service.js", () => ({ creditCoins: mocks.creditCoins }));
vi.mock("../src/services/game.service.js", () => ({
  findActiveGameByKey: mocks.findActiveGameByKey
}));

import { completePracticeAttempt } from "../src/services/challenge-attempt.service.js";

describe("authoritative practice rewards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const session = {
      withTransaction: vi.fn(async (work: () => Promise<void>) => work()),
      endSession: vi.fn().mockResolvedValue(undefined)
    } as unknown as ClientSession;
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
    mocks.findActiveGameByKey.mockResolvedValue({
      _id: new Types.ObjectId(),
      key: "tetris",
      practiceEnabled: true,
      scoring: { maxCoins: 1_000 }
    });
    const attemptId = new Types.ObjectId();
    mocks.attemptCreate.mockResolvedValue([
      {
        _id: attemptId,
        gameKey: "tetris",
        score: 50_000,
        coinsAwarded: 1_000,
        completedAt: new Date("2026-08-20T10:00:00.000Z")
      }
    ]);
    mocks.creditCoins.mockResolvedValue({ balanceAfter: 1_250, idempotentReplay: false });
    mocks.userFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        coins: { balance: 1_250, lifetimeEarned: 1_250, referralEarned: 0 }
      })
    });
  });

  it("credits and returns the same capped amount shown for the completed game", async () => {
    const userId = new Types.ObjectId();
    const result = await completePracticeAttempt({ userId, gameKey: "tetris", score: 50_000 });
    expect(mocks.creditCoins).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        amount: 1_000,
        type: "practice_coin_reward"
      }),
      expect.anything()
    );
    expect(result.attempt.coinsAwarded).toBe(1_000);
    expect(result.coins.balance).toBe(1_250);
  });
});
