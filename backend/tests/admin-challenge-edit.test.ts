import { Types } from "mongoose";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), games: vi.fn(), notify: vi.fn() }));
vi.mock("../src/config/env.js", () => ({ env: { DEFAULT_TIMEZONE: "UTC" } }));
vi.mock("../src/models/DailyChallengeSet.js", () => ({ DailyChallengeSet: { findOne: mocks.find, findOneAndUpdate: mocks.update } }));
vi.mock("../src/models/Game.js", () => ({ Game: { find: mocks.games } }));
vi.mock("../src/models/NotificationEvent.js", () => ({ NotificationEvent: { findOneAndUpdate: mocks.notify } }));
vi.mock("../src/services/contest.service.js", () => ({ settleExpiredDailyContests: vi.fn() }));
vi.mock("../src/services/notification.service.js", () => ({ dispatchNotificationEvent: vi.fn() }));
vi.mock("../src/services/daily-challenge.service.js", () => ({ challengeDayKey: () => "2026-09-20" }));
vi.mock("../src/services/serialization.service.js", () => ({ serializeGame: (game: unknown) => game }));
import { configureDailyChallenge } from "../src/services/admin.service.js";
const games = Array.from({ length: 7 }, (_, i) => ({ _id: new Types.ObjectId(), key: `game-${i}` }));
let existing: Record<string, any>;
const input = { dayKey: "2026-09-20", adminSubject: "test-admin", selectionMode: "random" as const, cashPrizeMinUnits: 10, cashPrizeMaxUnits: 100, prizePoolUnits: 1000, publish: true };
beforeEach(() => {
  vi.clearAllMocks();
  existing = { _id: new Types.ObjectId(), dayKey: input.dayKey, status: "published", selectionMode: "random", selectionSeed: "original", gameIds: games.slice(0, 6).map(g => g._id), publishedAt: new Date("2026-09-20T00:00:00Z"), endsAt: new Date("2026-09-21T00:00:00Z") };
  mocks.find.mockImplementation(() => Object.assign(Promise.resolve(existing), { lean: () => Promise.resolve(existing) }));
  mocks.games.mockReturnValue({ sort: () => ({ lean: () => Promise.resolve(games) }), lean: () => Promise.resolve(games) });
  mocks.update.mockImplementation((_filter, update) => { Object.assign(existing, update.$set); return Promise.resolve(existing); });
});
it("updates published prizes without rerolling games or restarting the deadline", async () => {
  const ids = [...existing.gameIds];
  await configureDailyChallenge(input);
  expect(existing.gameIds).toEqual(ids);
  expect(existing.endsAt.toISOString()).toBe("2026-09-21T00:00:00.000Z");
  expect(existing.prizePoolUnits).toBe(1000);
  expect(mocks.notify).not.toHaveBeenCalled();
});
it("keeps a published challenge live when Save submits publish=false", async () => {
  await configureDailyChallenge({ ...input, publish: false });
  expect(existing.status).toBe("published");
  expect(mocks.update.mock.calls[0]![1]).not.toHaveProperty("$unset");
});
it("accepts an explicit replacement of the six games", async () => {
  await configureDailyChallenge({ ...input, selectionMode: "manual", gameKeys: games.slice(1).map(g => g.key) });
  expect(existing.gameIds).toEqual(games.slice(1).map(g => g._id));
  expect(existing.status).toBe("published");
});
it("still protects a settled challenge", async () => {
  existing.status = "settled";
  await expect(configureDailyChallenge(input)).rejects.toMatchObject({ code: "challenge_already_settled" });
  expect(mocks.update).not.toHaveBeenCalled();
});
