import { Types } from "mongoose";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ set: vi.fn(), standings: vi.fn(), users: vi.fn() }));
vi.mock("../src/models/DailyChallengeSet.js", () => ({ DailyChallengeSet: { findOne: () => ({ lean: mocks.set }) } }));
vi.mock("../src/models/User.js", () => ({ User: { find: () => ({ select: () => ({ lean: mocks.users }) }) } }));
vi.mock("../src/services/contest.service.js", () => ({ collectContestStandings: mocks.standings }));
vi.mock("../src/services/daily-challenge.service.js", () => ({ challengeDayKey: () => "2026-09-20" }));
import { getContestProgress } from "../src/services/contest-progress.service.js";
beforeEach(() => vi.resetAllMocks());
it("returns an empty state without creating or settling a challenge", async () => {
  mocks.set.mockResolvedValue(null);
  const result = await getContestProgress(new Types.ObjectId());
  expect(result.neighbors).toEqual([]);
  expect(mocks.standings).not.toHaveBeenCalled();
});
it("returns public identity only and the authenticated player's actual score", async () => {
  const userId = new Types.ObjectId();
  mocks.set.mockResolvedValue({ cashPrizeMinUnits: 10, cashPrizeMaxUnits: 100 });
  mocks.standings.mockResolvedValue([{ userId: userId.toString(), totalCoins: 6432, completedGamesCount: 5, finishedAt: null }]);
  mocks.users.mockResolvedValue([{ _id: userId, name: "Test", avatarUrl: null, email: "private@example.com" }]);
  const result = await getContestProgress(userId);
  expect(result.self?.totalCoins).toBe(6432);
  expect(result.projectedCashUnits).toBe(100);
  expect(result.neighbors[0]).toEqual({ userId: userId.toString(), name: "Test", avatarUrl: null, rank: 1, totalCoins: 6432, isSelf: true });
});
