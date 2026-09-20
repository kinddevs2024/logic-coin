import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  userFindById: vi.fn(),
  challengeFindOne: vi.fn(),
  challengeFindOneAndUpdate: vi.fn(),
  gameFind: vi.fn(),
  challengeDistinct: vi.fn(),
  challengeCountDocuments: vi.fn(),
  ledgerExists: vi.fn(),
  ledgerAggregate: vi.fn(),
  settleExpired: vi.fn(),
  notificationFindOneAndUpdate: vi.fn(),
  dispatchNotificationEvent: vi.fn()
}));

vi.mock("../src/config/env.js", () => ({ env: { DEFAULT_TIMEZONE: "UTC" } }));
vi.mock("../src/models/User.js", () => ({ User: { findById: modelMocks.userFindById } }));
vi.mock("../src/models/DailyChallengeSet.js", () => ({
  DailyChallengeSet: {
    findOne: modelMocks.challengeFindOne,
    findOneAndUpdate: modelMocks.challengeFindOneAndUpdate
  }
}));
vi.mock("../src/models/Game.js", () => ({ Game: { find: modelMocks.gameFind } }));
vi.mock("../src/models/ChallengeAttempt.js", () => ({
  ChallengeAttempt: {
    distinct: modelMocks.challengeDistinct,
    countDocuments: modelMocks.challengeCountDocuments,
    find: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) })
  }
}));
vi.mock("../src/models/CoinLedgerEntry.js", () => ({
  CoinLedgerEntry: {
    exists: modelMocks.ledgerExists,
    aggregate: modelMocks.ledgerAggregate
  }
}));
vi.mock("../src/models/NotificationEvent.js", () => ({
  NotificationEvent: { findOneAndUpdate: modelMocks.notificationFindOneAndUpdate }
}));
vi.mock("../src/services/notification.service.js", () => ({
  dispatchNotificationEvent: modelMocks.dispatchNotificationEvent
}));
vi.mock("../src/services/contest.service.js", () => ({
  settleExpiredDailyContests: modelMocks.settleExpired
}));

import {
  ensureDailyChallengeSet,
  getTodayChallengeOverview
} from "../src/services/daily-challenge.service.js";

function makeGames() {
  return Array.from({ length: 8 }, (_, index) => ({
    _id: new Types.ObjectId(),
    key: `game-${index}`,
    slug: `game-${index}`,
    enabled: true,
    challengeEnabled: true,
    practiceEnabled: true,
    engine: "native",
    icon: "grid",
    color: "#087CFF",
    difficulty: "medium",
    sortOrder: index,
    scoring: { higherIsBetter: true, maxCoins: 1_000 },
    title: { en: `Game ${index}`, ru: `Game ${index}`, uz: `Game ${index}` },
    description: { en: "Game", ru: "Game", uz: "Game" }
  }));
}

describe("daily challenge auto-creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.userFindById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        preferences: { language: "ru" },
        coins: { balance: 25, lifetimeEarned: 50, referralEarned: 0 }
      })
    });
    modelMocks.challengeDistinct.mockResolvedValue(["2026-08-01", "2026-08-04"]);
    modelMocks.challengeCountDocuments.mockResolvedValue(3);
    modelMocks.ledgerExists.mockResolvedValue(null);
    modelMocks.ledgerAggregate.mockResolvedValue([]);
    modelMocks.notificationFindOneAndUpdate.mockResolvedValue({
      _id: new Types.ObjectId(), status: "sent", targetCount: 0, sentCount: 0, failedCount: 0
    });
  });

  it("auto-creates and publishes today's missing set with six random games", async () => {
    const games = makeGames();
    modelMocks.gameFind.mockImplementation(() => ({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(games) }),
      lean: vi.fn().mockResolvedValue(games)
    }));
    modelMocks.challengeFindOne.mockResolvedValue(null);
    const publishedAt = new Date();
    modelMocks.challengeFindOneAndUpdate.mockImplementation(async (_filter, update) => ({
      ...(update.$setOnInsert as Record<string, unknown>),
      status: "published",
      publishedAt
    }));

    const result = await getTodayChallengeOverview(new Types.ObjectId());

    expect(modelMocks.challengeFindOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(modelMocks.notificationFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ eventKey: expect.any(String) }),
      expect.objectContaining({ $setOnInsert: expect.objectContaining({ type: "daily_challenge_published" }) }),
      expect.objectContaining({ upsert: true })
    );
    const [, update, options] = modelMocks.challengeFindOneAndUpdate.mock.calls[0] as [
      unknown,
      { $setOnInsert: Record<string, unknown> },
      { upsert: boolean }
    ];
    expect(options).toMatchObject({ upsert: true });
    expect(update.$setOnInsert.status).toBe("published");
    expect(update.$setOnInsert.selectionMode).toBe("random");
    expect((update.$setOnInsert.gameIds as unknown[]).length).toBe(6);
    expect(update.$setOnInsert.cashPrizeMinUnits).toBe(500);
    expect(update.$setOnInsert.cashPrizeMaxUnits).toBe(10_000);
    expect(update.$setOnInsert.prizePoolUnits).toBe(100_000);

    expect(result).toMatchObject({
      status: "published",
      available: true,
      totalCount: 6,
      completedCount: 0,
      gamesCompletedToday: 3,
      monthlyChallengeCount: 2
    });
    expect(result.games.length).toBe(6);
    expect(result.endsAt).toBe((update.$setOnInsert.endsAt as Date).toISOString());
    expect(result.games.every(game => game.state.status === "not_started")).toBe(true);
    expect(result.prizes).toMatchObject({
      cashMinUnits: 500,
      cashMaxUnits: 10_000,
      poolUnits: 100_000
    });
  });

  it("returns no_challenge when the game catalog is too small to auto-create", async () => {
    modelMocks.gameFind.mockImplementation(() => ({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(makeGames().slice(0, 3)) }),
      lean: vi.fn().mockResolvedValue([])
    }));
    modelMocks.challengeFindOne.mockResolvedValue(null);

    const result = await getTodayChallengeOverview(new Types.ObjectId());

    expect(result).toMatchObject({ status: "no_challenge", available: false, totalCount: 0 });
    expect(modelMocks.challengeFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("never auto-creates a set for a future day", async () => {
    modelMocks.challengeFindOne.mockResolvedValue(null);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1_000);
    const dayKey = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}-${String(
      tomorrow.getUTCDate()
    ).padStart(2, "0")}`;

    await expect(ensureDailyChallengeSet(dayKey)).resolves.toBeNull();
    expect(modelMocks.challengeFindOneAndUpdate).not.toHaveBeenCalled();
  });
});
