import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose, { Types } from "mongoose";
const coins = vi.hoisted(() => ({ credit: vi.fn(), balance: vi.fn() }));
vi.mock("../src/services/coin.service.js", () => ({ creditCoins: coins.credit, getCoinBalance: coins.balance }));
import { ChallengeAttempt } from "../src/models/ChallengeAttempt.js";
import { RewardedAdSession } from "../src/models/RewardedAdSession.js";
import { DailyChallengeSet } from "../src/models/DailyChallengeSet.js";
import { ChallengeAdReward } from "../src/models/ChallengeAdReward.js";
import { claimRewardedAdCoins, startRewardedAdSession } from "../src/services/rewarded-ad-session.service.js";
import { challengeDayKey } from "../src/services/daily-challenge.service.js";

describe("fortune reward belongs to one completed game", () => {
  beforeEach(() => { vi.restoreAllMocks(); coins.credit.mockReset().mockResolvedValue({ idempotentReplay: false }); coins.balance.mockReset().mockResolvedValue({ balance: 500 }); });
  it("rejects foreign, expired or already rewarded attempts before starting ads", async () => {
    const find = vi.spyOn(ChallengeAttempt, "findOne").mockResolvedValue(null);
    const userId = new Types.ObjectId(); const attemptId = new Types.ObjectId().toString();
    await expect(startRewardedAdSession(userId, "fortune-wheel", "yandex", attemptId)).rejects.toThrow("недоступен");
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ _id: attemptId, userId, status: "completed", completedAt: { $gte: expect.any(Date) }, fortuneRewardSessionId: { $exists: false } }));
  });
  it("does not accept a game association on another placement", async () => {
    await expect(startRewardedAdSession(new Types.ObjectId(), "navigation-frequency", "yandex", new Types.ObjectId().toString())).rejects.toThrow("Неверная");
  });
  it("credits the wallet and challenge points once, and replays without double credit", async () => {
    const userId = new Types.ObjectId(); const attemptId = new Types.ObjectId();
    const sessionId = "7bc84887-1936-40f1-a87c-39141652b4bd";
    const dayKey = challengeDayKey();
    const ad = { sessionId, userId, placement: "fortune-wheel", gameAttemptId: attemptId, status: "completed", rewardCoins: 200, provider: "yandex", expiresAt: new Date(Date.now() + 60000), save: vi.fn() };
    vi.spyOn(mongoose, "startSession").mockResolvedValue({ withTransaction: async (task: () => Promise<void>) => task(), endSession: async () => {} } as never);
    vi.spyOn(RewardedAdSession, "findOne").mockReturnValue({ session: async () => ad } as never);
    const lock = vi.spyOn(ChallengeAttempt, "findOneAndUpdate").mockResolvedValue({ mode: "challenge", dayKey, dailyChallengeSetId: new Types.ObjectId() } as never);
    vi.spyOn(DailyChallengeSet, "findOne").mockReturnValue({ session: async () => ({ dayKey }) } as never);
    const create = vi.spyOn(ChallengeAdReward, "create").mockResolvedValue([] as never);
    vi.spyOn(ChallengeAdReward, "findOne").mockReturnValue({ session: async () => ({ dayKey }) } as never);
    expect((await claimRewardedAdCoins({ userId, sessionId })).credited).toBe(200);
    expect(lock).toHaveBeenCalledWith(expect.objectContaining({ _id: attemptId, userId, status: "completed", fortuneRewardSessionId: { $exists: false } }), expect.anything(), expect.anything());
    expect(create).toHaveBeenCalledWith([expect.objectContaining({ userId, sessionId, dayKey, amount: 200 })], expect.anything());
    expect((await claimRewardedAdCoins({ userId, sessionId })).credited).toBe(0);
    expect(coins.credit).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(lock).toHaveBeenCalledTimes(1);
  });
});
