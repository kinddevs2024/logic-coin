import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findOne: vi.fn(), update: vi.fn(), aggregate: vi.fn(), credit: vi.fn(), user: vi.fn() }));
vi.mock("../src/config/env.js", () => ({ env: { DEFAULT_TIMEZONE: "UTC" } }));
vi.mock("../src/models/ChallengeAttempt.js", () => ({ ChallengeAttempt: { findOne: mocks.findOne, findOneAndUpdate: mocks.update } }));
vi.mock("../src/models/CoinLedgerEntry.js", () => ({ CoinLedgerEntry: { aggregate: mocks.aggregate } }));
vi.mock("../src/models/User.js", () => ({ User: { findById: mocks.user } }));
vi.mock("../src/services/coin.service.js", () => ({ creditCoins: mocks.credit }));
vi.mock("../src/services/gift.service.js", () => ({ activateNextChallengeCoinGifts: vi.fn() }));
vi.mock("../src/services/game.service.js", () => ({ findActiveGameByKey: async () => ({ _id: new Types.ObjectId("000000000000000000000001"), key: "math", scoring: { maxCoins: 1000 } }) }));
vi.mock("../src/services/daily-challenge.service.js", () => ({ challengeDayKey: () => "2026-10-04", getDailyChallengeSet: async () => ({ _id: new Types.ObjectId(), status: "published", gameIds: [new Types.ObjectId("000000000000000000000001")] }) }));
import mongoose from "mongoose";
import { completeChallengeAttempt } from "../src/services/challenge-attempt.service.js";

describe("transactional challenge base allowance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mongoose, "startSession").mockResolvedValue({ withTransaction: async (run: () => Promise<void>) => run(), endSession: async () => {} } as never);
    mocks.user.mockReturnValue({ select: async () => ({ coins: { balance: 6000, lifetimeEarned: 6000 } }) });
    mocks.findOne.mockReturnValue({ session: async () => ({ metadata: {} }) });
    mocks.aggregate.mockReturnValue({ session: async () => [{ total: 5750 }] });
    mocks.update.mockImplementation(async (_query, update) => ({ _id: new Types.ObjectId(), gameKey: "math", metadata: {}, ...update.$set }));
    mocks.credit.mockResolvedValue({ idempotentReplay: false });
  });
  it("records the full calibrated reward despite earlier daily earnings", async () => {
    const result = await completeChallengeAttempt({ userId: new Types.ObjectId(), gameKey: "math", score: 50000 });
    expect(result.attempt.coinsAwarded).toBe(2129);
    expect(mocks.credit.mock.calls[0]?.[0]).toMatchObject({ amount: 2129, metadata: { kind: "base", dayKey: "2026-10-04" } });
  });
  it("does not suppress rewards at the old six-thousand daily ceiling", async () => {
    mocks.aggregate.mockReturnValue({ session: async () => [{ total: 6000 }] });
    const result = await completeChallengeAttempt({ userId: new Types.ObjectId(), gameKey: "math", score: 50000 });
    expect(result.attempt.coinsAwarded).toBe(2129);
    expect(mocks.credit.mock.calls[0]?.[0]).toMatchObject({ amount: 2129 });
  });
  it("records an authorized replay separately from base earnings", async () => {
    mocks.findOne.mockReturnValue({ session: async () => ({ metadata: { replayCount: 1 } }) });
    mocks.update.mockImplementation(async (_query, update) => ({ _id: new Types.ObjectId(), gameKey: "math", metadata: { replayCount: 1 }, ...update.$set }));
    const result = await completeChallengeAttempt({ userId: new Types.ObjectId(), gameKey: "math", score: 50000 });
    expect(result.attempt.coinsAwarded).toBe(2129);
    expect(mocks.credit.mock.calls[0]?.[0]).toMatchObject({ amount: 2129, metadata: { kind: "replay-bonus" } });
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
});
