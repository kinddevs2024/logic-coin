import express from "express";
import request from "supertest";
import { Types } from "mongoose";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ sets: [] as unknown[], attempts: [] as unknown[], current: null as unknown, settlement: null as unknown }));
vi.mock("../src/services/daily-challenge.service.js", () => ({ challengeDayKey: () => "2026-10-08" }));
vi.mock("../src/models/HomeContent.js", () => ({ HomeContent: { findOne: () => ({ lean: async () => null }) } }));
vi.mock("../src/models/DailyChallengeSet.js", () => ({ DailyChallengeSet: {
  find: () => ({ select: () => ({ lean: async () => state.sets }) }),
  findOne: () => ({ sort: () => ({ lean: async () => state.current }) }),
} }));
vi.mock("../src/models/ChallengeAttempt.js", () => ({ ChallengeAttempt: { find: () => ({ select: () => ({ lean: async () => state.attempts }) }) } }));
vi.mock("../src/models/DailyContestSettlement.js", () => ({ DailyContestSettlement: { findOne: () => ({ select: () => ({ lean: async () => state.settlement }) }) } }));
import router from "../src/routes/home.routes.js";
const app = express();
app.use((req, _res, next) => { req.auth = { userId: new Types.ObjectId(), sessionId: "qa" }; next(); });
app.use(router);
beforeEach(() => { state.sets = []; state.attempts = []; state.current = null; state.settlement = null; });
it("returns real calendar denominators and empty configurable content", async () => {
  const response = await request(app).get("/").expect(200);
  expect(response.body.data.weekly).toMatchObject({ completed: 0, total: 7 });
  expect(response.body.data.monthly).toMatchObject({ completed: 0, total: 31 });
  expect(response.body.data.content.rules).toBe("");
  expect(response.body.data.championship).toBeNull();
});
it("counts each completed whole set once, not partial or duplicated attempts", async () => {
  state.sets = [{ _id: "a", dayKey: "2026-10-06", gameIds: ["1", "2"] }, { _id: "b", dayKey: "2026-10-07", gameIds: ["1", "2"] }];
  state.attempts = [{ dailyChallengeSetId: "a", gameId: "1" }, { dailyChallengeSetId: "a", gameId: "1" }, { dailyChallengeSetId: "a", gameId: "2" }, { dailyChallengeSetId: "b", gameId: "1" }];
  const response = await request(app).get("/").expect(200);
  expect(response.body.data.weekly.completed).toBe(1);
  expect(response.body.data.monthly.completed).toBe(1);
});
it("does not invent result publication from game completion or an expired deadline", async () => {
  state.current = { dayKey: "2026-10-08", endsAt: new Date("2026-10-08T00:00:00Z") };
  state.settlement = { status: "settling" };
  let response = await request(app).get("/").expect(200);
  expect(response.body.data.championship.resultsPublished).toBe(false);
  state.settlement = { status: "settled" };
  response = await request(app).get("/").expect(200);
  expect(response.body.data.championship.resultsPublished).toBe(true);
});
