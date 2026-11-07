import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ results: [] as unknown[], own: null as unknown, settlement: null as unknown, set: null as unknown, ranked: [] as unknown[] }));
const query = (value: unknown) => { const q: Record<string, unknown> = {}; for (const key of ["sort", "skip", "limit", "select"]) q[key] = () => q; q.lean = () => Promise.resolve(value); return q; };
vi.mock("../src/models/DailyChallengeSet.js", () => ({ DailyChallengeSet: { find: () => query([]), findOne: () => query(mocks.set) } }));
vi.mock("../src/models/DailyContestSettlement.js", () => ({ DailyContestSettlement: { find: () => query([]), findOne: () => query(mocks.settlement) } }));
vi.mock("../src/models/DailyContestResult.js", () => ({ DailyContestResult: { find: () => query(mocks.results), findOne: () => query(mocks.own), countDocuments: async () => mocks.results.length } }));
vi.mock("../src/models/User.js", () => ({ User: { find: () => query([]) } }));
vi.mock("../src/services/contest.service.js", () => ({ collectContestStandings: async () => [] }));
vi.mock("../src/services/daily-challenge.service.js", () => ({ challengeDayKey: () => "2026-10-31" }));
vi.mock("../src/lib/manual-contest-prizes.js", () => ({ contestPrizePlan: () => ({ ranked: mocks.ranked }) }));
import { Types } from "mongoose";
import { getContestHistory } from "../src/services/contest-history.service.js";
describe("history cash prizes", () => {
  const id = new Types.ObjectId();
  it("preserves the selected day's settled cash for rows and own dock", async () => {
    mocks.settlement = {}; mocks.set = {}; mocks.own = { userId: id, rank: 1, totalCoins: 1500, cashUnits: 125, completedGamesCount: 6 }; mocks.results = [mocks.own];
    const result = await getContestHistory("2026-10-30", 0, id);
    expect(result.status).toBe("final"); expect(result.rows[0]?.cashUnits).toBe(125); expect(result.self?.cashUnits).toBe(125);
  });
  it("shows zero for a non-cash prize, including legacy records", async () => {
    mocks.own = { userId: id, rank: 10, totalCoins: 500, completedGamesCount: 6 }; mocks.results = [mocks.own];
    const result = await getContestHistory("2026-10-30", 0, id);
    expect(result.rows[0]?.cashUnits).toBe(0); expect(result.self?.cashUnits).toBe(0);
  });
  it("uses the configured prize plan for live estimates", async () => {
    mocks.settlement = null; mocks.set = {}; mocks.ranked = [{ userId: id.toString(), rank: 1, totalCoins: 600, cashUnits: 80, completedGamesCount: 3 }];
    const result = await getContestHistory(undefined, 0, id);
    expect(result.status).toBe("live"); expect(result.rows[0]?.cashUnits).toBe(80); expect(result.self?.cashUnits).toBe(80);
  });
});
