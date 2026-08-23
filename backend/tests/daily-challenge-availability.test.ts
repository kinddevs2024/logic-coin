import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  userFindById: vi.fn(),
  challengeFindOne: vi.fn(),
  challengeDistinct: vi.fn(),
  challengeCountDocuments: vi.fn(),
  settleExpired: vi.fn()
}));

vi.mock("../src/config/env.js", () => ({ env: { DEFAULT_TIMEZONE: "UTC" } }));
vi.mock("../src/models/User.js", () => ({ User: { findById: modelMocks.userFindById } }));
vi.mock("../src/models/DailyChallengeSet.js", () => ({
  DailyChallengeSet: { findOne: modelMocks.challengeFindOne }
}));
vi.mock("../src/models/Game.js", () => ({ Game: {} }));
vi.mock("../src/models/ChallengeAttempt.js", () => ({
  ChallengeAttempt: {
    distinct: modelMocks.challengeDistinct,
    countDocuments: modelMocks.challengeCountDocuments
  }
}));
vi.mock("../src/models/CoinLedgerEntry.js", () => ({ CoinLedgerEntry: {} }));
vi.mock("../src/services/contest.service.js", () => ({
  settleExpiredDailyContests: modelMocks.settleExpired
}));

import { getTodayChallengeOverview } from "../src/services/daily-challenge.service.js";

describe("daily challenge publication boundary", () => {
  it("returns a stable no-challenge object and never auto-creates a set", async () => {
    modelMocks.userFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        preferences: { language: "ru" },
        coins: { balance: 25, lifetimeEarned: 50, referralEarned: 0 }
      })
    });
    modelMocks.challengeFindOne.mockResolvedValue(null);
    modelMocks.challengeDistinct.mockResolvedValue(["2026-08-01", "2026-08-04"]);
    modelMocks.challengeCountDocuments.mockResolvedValue(3);

    const result = await getTodayChallengeOverview(new Types.ObjectId());

    expect(result).toMatchObject({
      status: "no_challenge",
      available: false,
      totalCount: 0,
      gamesCompletedToday: 3,
      monthlyChallengeCount: 2,
      games: [],
      prizes: null
    });
    expect(result.nextChallengeAt).toMatch(/T/);
    expect(modelMocks.settleExpired).toHaveBeenCalledWith(result.dayKey);
    expect(modelMocks.challengeFindOne).toHaveBeenCalledTimes(1);
  });
});
