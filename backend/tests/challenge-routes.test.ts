import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const challengeMocks = vi.hoisted(() => ({
  getTodayChallengeOverview: vi.fn(),
  startChallengeAttempt: vi.fn(),
  completeChallengeAttempt: vi.fn(),
  completePracticeAttempt: vi.fn(),
  doubleChallengeCoins: vi.fn(),
  getContestResultForUser: vi.fn(),
  getPendingContestReward: vi.fn(),
  claimContestReward: vi.fn()
}));

vi.mock("../src/services/daily-challenge.service.js", () => ({
  getTodayChallengeOverview: challengeMocks.getTodayChallengeOverview
}));
vi.mock("../src/services/challenge-attempt.service.js", () => ({
  startChallengeAttempt: challengeMocks.startChallengeAttempt,
  completeChallengeAttempt: challengeMocks.completeChallengeAttempt,
  completePracticeAttempt: challengeMocks.completePracticeAttempt,
  doubleChallengeCoins: challengeMocks.doubleChallengeCoins
}));
vi.mock("../src/services/contest.service.js", () => ({
  getContestResultForUser: challengeMocks.getContestResultForUser,
  getPendingContestReward: challengeMocks.getPendingContestReward,
  claimContestReward: challengeMocks.claimContestReward
}));

import challengeRoutes from "../src/routes/challenges.routes.js";

describe("challenge routes", () => {
  const userId = new Types.ObjectId();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = { userId, sessionId: new Types.ObjectId().toString() };
    next();
  });
  app.use("/", challengeRoutes);
  app.use((
    error: { statusCode?: number; code?: string },
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    res.status(error.statusCode ?? 500).json({ error: { code: error.code ?? "internal_error" } });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    challengeMocks.getTodayChallengeOverview.mockResolvedValue({
      dayKey: "2026-08-20",
      totalCount: 6,
      completedCount: 0,
      games: []
    });
    challengeMocks.startChallengeAttempt.mockResolvedValue({
      attemptId: new Types.ObjectId().toString(),
      dayKey: "2026-08-20",
      gameKey: "tetris",
      status: "started",
      resumed: false
    });
    challengeMocks.completeChallengeAttempt.mockResolvedValue({
      attempt: { idempotentReplay: false },
      coins: { balance: 500, lifetimeEarned: 500, referralEarned: 0 }
    });
    challengeMocks.doubleChallengeCoins.mockResolvedValue({
      scope: "game",
      credited: 500,
      idempotentReplay: false,
      coins: { balance: 1_000 },
      adVerification: { provider: "demo", verified: true, placeholder: true }
    });
    challengeMocks.getPendingContestReward.mockResolvedValue(null);
    challengeMocks.claimContestReward.mockResolvedValue({
      result: { id: new Types.ObjectId().toString(), claimStatus: "claimed" },
      wallet: { availableUnits: 100 },
      coins: { balance: 500 }
    });
  });

  it("returns one shared daily set", async () => {
    const response = await request(app).get("/today").expect(200);
    expect(response.body.data.today.totalCount).toBe(6);
  });

  it("starts a challenge and validates score limits before completion", async () => {
    await request(app).post("/tetris/start").set("User-Agent", "okhttp/4.12.0").expect(201);
    expect(challengeMocks.startChallengeAttempt).toHaveBeenCalledWith({ userId, gameKey: "tetris" });
    await request(app).post("/tetris/complete").set("User-Agent", "okhttp/4.12.0").send({ score: 1_000_000_001 }).expect(400);
    expect(challengeMocks.completeChallengeAttempt).not.toHaveBeenCalled();
  });

  it("keeps the rewarded-ad placeholder explicit in the double contract", async () => {
    await request(app)
      .post("/double")
      .set("User-Agent", "okhttp/4.12.0")
      .send({ scope: "game", ad: { provider: "demo", receiptId: "demo-receipt" } })
      .expect(201);
    expect(challengeMocks.doubleChallengeCoins).toHaveBeenCalledWith({
      userId,
      scope: "game",
      ad: { provider: "demo", receiptId: "demo-receipt" }
    });
  });

  it("exposes and claims a server-owned pending contest reward", async () => {
    await request(app).get("/rewards/pending").expect(200);
    const resultId = new Types.ObjectId().toString();
    await request(app).post(`/rewards/${resultId}/claim`).expect(200);
    expect(challengeMocks.claimContestReward).toHaveBeenCalledWith(resultId, userId);
  });

  it.each(["/tetris/start", "/tetris/complete", "/double"])("blocks browser mutations at %s before calling services", async path => {
    const result = await request(app).post(path).set("User-Agent", "Mozilla/5.0 (Android 14)").set("Origin", "https://logic-coin.online").send({ score: 10 });
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe("challenge_app_required");
    expect(challengeMocks.startChallengeAttempt).not.toHaveBeenCalled();
    expect(challengeMocks.completeChallengeAttempt).not.toHaveBeenCalled();
    expect(challengeMocks.doubleChallengeCoins).not.toHaveBeenCalled();
  });

  it("preserves ordinary web games", async () => {
    await request(app).post("/practice/tetris/complete").set("User-Agent", "Mozilla/5.0").send({ score: 10 }).expect(201);
    expect(challengeMocks.completePracticeAttempt).toHaveBeenCalledWith({ userId, gameKey: "tetris", score: 10 });
  });
});
