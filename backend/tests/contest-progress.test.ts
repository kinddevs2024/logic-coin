import { Types } from "mongoose";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ set: vi.fn(), standings: vi.fn(), ids: vi.fn(), profiles: vi.fn(), find: vi.fn() }));
vi.mock("../src/models/DailyChallengeSet.js", () => ({ DailyChallengeSet: { findOne: () => ({ lean: mocks.set }) } }));
vi.mock("../src/models/User.js", () => ({ User: { find: mocks.find } }));
vi.mock("../src/services/contest.service.js", () => ({ collectContestStandings: mocks.standings }));
vi.mock("../src/services/daily-challenge.service.js", () => ({ challengeDayKey: () => "2026-09-20" }));
import { getContestProgress } from "../src/services/contest-progress.service.js";
const users = Array.from({ length: 17 }, (_, i) => ({ _id: new Types.ObjectId((i + 1).toString(16).padStart(24, "0")), name: `Player ${i}`, avatarUrl: null, email: "private@example.com" }));
let clock = Date.now();
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers(); vi.setSystemTime(clock += 360_000);
  mocks.set.mockResolvedValue({ cashPrizeMinUnits: 10, cashPrizeMaxUnits: 100 });
  mocks.standings.mockResolvedValue([]);
  mocks.ids.mockResolvedValue(users.map(({ _id }) => ({ _id })));
  mocks.find.mockImplementation(filter => ({ select: (fields: string) => ({ lean: fields === "_id" ? mocks.ids : () => {
    mocks.profiles(filter);
    return Promise.resolve(users.filter(user => filter._id.$in.some((id: Types.ObjectId) => id.equals(user._id))));
  } }) }));
});
afterEach(() => vi.useRealTimers());
it("includes zero-score users, centers self, and returns only five public profiles", async () => {
  const page = await getContestProgress(users[8]!._id);
  expect(page.neighbors.map(row => row.rank)).toEqual([7, 8, 9, 10, 11]);
  expect(page.neighbors[2]?.isSelf).toBe(true);
  expect(page.projectedCashUnits).toBe(0);
  expect(page.participantCount).toBe(17);
  expect(mocks.profiles.mock.calls[0]![0]._id.$in).toHaveLength(5);
  expect(page.neighbors[0]).not.toHaveProperty("email");
});
it("paginates both ways with no overlaps, including a partial first page", async () => {
  const initial = await getContestProgress(users[8]!._id);
  const above = await getContestProgress(users[8]!._id, initial.previous!);
  const first = await getContestProgress(users[8]!._id, above.previous!);
  const below = await getContestProgress(users[8]!._id, initial.next!);
  const last = await getContestProgress(users[8]!._id, below.next!);
  const ranks = [first, above, initial, below, last].flatMap(page => page.neighbors.map(row => row.rank));
  expect(ranks).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
  expect(first.previous).toBeNull(); expect(last.next).toBeNull();
  expect(mocks.standings).toHaveBeenCalledTimes(1);
});
it("does not award idle users cash or let idle users alter actual prize bands", async () => {
  mocks.standings.mockResolvedValue([{ userId: users[8]!._id.toString(), totalCoins: 6432, completedGamesCount: 5, finishedAt: null }]);
  const page = await getContestProgress(users[8]!._id);
  expect(page.self?.rank).toBe(1); expect(page.projectedCashUnits).toBe(100);
  const idle = await getContestProgress(users[0]!._id);
  expect(idle.projectedCashUnits).toBe(0);
});
it("rejects expired cursors and supports a fresh ranking afterwards", async () => {
  const page = await getContestProgress(users[8]!._id);
  vi.setSystemTime(Date.now() + 300_001);
  await expect(getContestProgress(users[8]!._id, page.next!)).rejects.toMatchObject({ statusCode: 409 });
});
it("handles first, last and single-account rankings", async () => {
  expect((await getContestProgress(users[0]!._id)).previous).toBeNull();
  const last = await getContestProgress(users[16]!._id);
  expect(last.next).toBeNull();
  expect(last.neighbors.map(row => row.rank)).toEqual([13, 14, 15, 16, 17]);
  expect(last.previous).not.toBeNull();
  vi.setSystemTime(Date.now() + 300_001);
  mocks.ids.mockResolvedValue([{ _id: users[0]!._id }]);
  const single = await getContestProgress(users[0]!._id);
  expect(single.neighbors).toHaveLength(1); expect(single.next).toBeNull();
});
