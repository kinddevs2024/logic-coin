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
    await request(app).post("/tetris/start").expect(201);
    expect(challengeMocks.startChallengeAttempt).toHaveBeenCalledWith({ userId, gameKey: "tetris" });
    await request(app).post("/tetris/complete").send({ score: 1_000_000_001 }).expect(400);
    expect(challengeMocks.completeChallengeAttempt).not.toHaveBeenCalled();
  });

  it("keeps the rewarded-ad placeholder explicit in the double contract", async () => {
    await request(app)
      .post("/double")
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
});
