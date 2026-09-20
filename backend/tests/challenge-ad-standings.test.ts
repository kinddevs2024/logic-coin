import { beforeEach, expect, it, vi } from "vitest";
import { Types } from "mongoose";
const mocks = vi.hoisted(() => ({ attempts: vi.fn(), bonus: vi.fn(), totals: vi.fn() }));
vi.mock("../src/models/ChallengeAttempt.js", () => ({ ChallengeAttempt: { find: () => ({ select: () => ({ lean: mocks.attempts }) }) } }));
vi.mock("../src/models/ChallengeAdReward.js", () => ({ ChallengeAdReward: { find: () => ({ lean: mocks.bonus }) } }));
vi.mock("../src/models/CoinLedgerEntry.js", () => ({ CoinLedgerEntry: { aggregate: mocks.totals } }));
import { collectContestStandings } from "../src/services/contest.service.js";
const userId = new Types.ObjectId();
const gameId = new Types.ObjectId();
const completedAt = new Date("2026-09-20T10:00:00Z");
beforeEach(() => {
  mocks.attempts.mockResolvedValue([{ userId, gameId, completedAt }]);
  mocks.bonus.mockResolvedValue([{ userId, amount: 45, createdAt: completedAt }]);
  mocks.totals.mockResolvedValue([{ _id: userId, totalCoins: 100 }]);
});
it("adds ad points to the same totals used for ranking and settlement", async () => {
  expect(await collectContestStandings("2026-09-20")).toEqual([{ userId: userId.toString(), totalCoins: 145, completedGamesCount: 1, finishedAt: completedAt.toISOString() }]);
});
it("does not invent a completed game when a user only watched an ad", async () => {
  mocks.attempts.mockResolvedValue([]);
  mocks.totals.mockResolvedValue([]);
  expect(await collectContestStandings("2026-09-20")).toEqual([{ userId: userId.toString(), totalCoins: 45, completedGamesCount: 0, finishedAt: completedAt.toISOString() }]);
});
