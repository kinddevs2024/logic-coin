import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gameFind: vi.fn(),
  setFindOne: vi.fn(),
  setFindOneAndUpdate: vi.fn(),
  deviceCount: vi.fn(),
  notificationFindOneAndUpdate: vi.fn(),
  dispatchNotificationEvent: vi.fn()
}));

vi.mock("../src/models/Game.js", () => ({ Game: { find: mocks.gameFind } }));
vi.mock("../src/models/DailyChallengeSet.js", () => ({
  DailyChallengeSet: {
    findOne: mocks.setFindOne,
    findOneAndUpdate: mocks.setFindOneAndUpdate
  }
}));
vi.mock("../src/models/ChallengeAttempt.js", () => ({ ChallengeAttempt: { exists: vi.fn() } }));
vi.mock("../src/models/Device.js", () => ({ Device: { countDocuments: mocks.deviceCount } }));
vi.mock("../src/models/NotificationEvent.js", () => ({
  NotificationEvent: { findOneAndUpdate: mocks.notificationFindOneAndUpdate }
}));
vi.mock("../src/services/notification.service.js", () => ({
  dispatchNotificationEvent: mocks.dispatchNotificationEvent
}));
vi.mock("../src/services/contest.service.js", () => ({
  settleExpiredDailyContests: vi.fn()
}));

import { configureDailyChallenge } from "../src/services/admin.service.js";

describe("challenge publication notification outbox", () => {
  it("queues one durable all-user event on first publication", async () => {
    const games = Array.from({ length: 6 }, (_, index) => ({
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
      title: { en: `Game ${index}`, ru: `Игра ${index}`, uz: `Game ${index}` },
      description: { en: "Game", ru: "Игра", uz: "Game" }
    }));
    mocks.gameFind.mockImplementation(() => ({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(games) }),
      lean: vi.fn().mockResolvedValue(games)
    }));
    mocks.setFindOne
      .mockResolvedValueOnce(null)
      .mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          dayKey: "2026-08-21",
          timezone: "UTC",
          status: "published",
          selectionMode: "manual",
          selectionSeed: "manual:2026-08-21",
          gameIds: games.map((game) => game._id),
          cashPrizeMinUnits: 500,
          cashPrizeMaxUnits: 10_000,
          prizePoolUnits: 100_000,
          publishedAt: new Date("2026-08-20T10:00:00.000Z")
        })
      });
    mocks.setFindOneAndUpdate.mockResolvedValue({});
    mocks.deviceCount.mockResolvedValue(12);
    mocks.notificationFindOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        status: "queued",
        targetCount: 12
      })
    });
    mocks.dispatchNotificationEvent.mockResolvedValue({
      status: "sent",
      targetCount: 12,
      sentCount: 12,
      failedCount: 0
    });

    const result = await configureDailyChallenge({
      dayKey: "2026-08-21",
      adminSubject: "password-admin",
      selectionMode: "manual",
      gameKeys: games.map((game) => game.key),
      cashPrizeMinUnits: 500,
      cashPrizeMaxUnits: 10_000,
      prizePoolUnits: 100_000,
      publish: true
    });

    expect(mocks.notificationFindOneAndUpdate).toHaveBeenCalledWith(
      { eventKey: "daily-challenge-published:2026-08-21" },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          type: "daily_challenge_published",
          audience: "all_users",
          status: "queued",
          targetCount: 12
        })
      }),
      { upsert: true, new: true, runValidators: true }
    );
    expect(mocks.dispatchNotificationEvent).toHaveBeenCalledOnce();
    expect(result.notificationEvent).toMatchObject({
      status: "sent",
      targetCount: 12,
      sentCount: 12,
      failedCount: 0
    });
  });
});
