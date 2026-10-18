import { Types } from "mongoose";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ standings: vi.fn(), users: vi.fn() }));
vi.mock("../src/services/contest.service.js", () => ({ collectContestStandings: mocks.standings }));
vi.mock("../src/services/daily-challenge.service.js", () => ({ challengeDayKey: () => "2026-10-18" }));
vi.mock("../src/models/DailyChallengeSet.js", () => ({ DailyChallengeSet: { findOne: () => ({ lean: async () => null }) } }));
vi.mock("../src/models/User.js", () => ({ User: { find: mocks.users } }));
import { getContestProgress, invalidateContestProgress } from "../src/services/contest-progress.service.js";
beforeEach(() => {
  invalidateContestProgress("2026-10-18");
  mocks.users.mockReset().mockReturnValue({ select: () => ({ lean: async () => [] }) });
});
it("only queries and lists today's participants, never every registered account", async () => {
  const participant = new Types.ObjectId();
  const outsider = new Types.ObjectId();
  mocks.standings.mockResolvedValue([{ userId: String(participant), totalCoins: 100, completedGamesCount: 1, finishedAt: new Date().toISOString() }]);
  const progress = await getContestProgress(outsider);
  expect(progress.participantCount).toBe(1);
  expect(progress.self).toBeNull();
  expect(progress.neighbors.map(row => row.userId)).toEqual([String(participant)]);
  expect(mocks.users).toHaveBeenCalledExactlyOnceWith({ _id: { $in: [participant] } });
});
it("keeps an empty challenge empty even for an authenticated account", async () => {
  mocks.standings.mockResolvedValue([]);
  const progress = await getContestProgress(new Types.ObjectId());
  expect(progress.neighbors).toEqual([]);
  expect(progress.participantCount).toBe(0);
});
