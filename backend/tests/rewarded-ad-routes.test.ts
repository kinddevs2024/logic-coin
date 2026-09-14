import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  status: vi.fn(),
  complete: vi.fn(),
  claim: vi.fn(),
  replay: vi.fn()
}));

vi.mock("../src/middleware/auth.js", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.auth = { userId: new Types.ObjectId("66c000000000000000000001"), sessionId: "test" };
    next();
  }
}));
vi.mock("../src/middleware/rate-limits.js", () => ({
  rewardLimiter: (_req: Request, _res: Response, next: NextFunction) => next()
}));
vi.mock("../src/services/rewarded-ad-session.service.js", () => ({
  startRewardedAdSession: mocks.start,
  getRewardedAdSession: mocks.status,
  completeRewardedAdFromClient: mocks.complete,
  claimRewardedAdCoins: mocks.claim,
  claimFirstChallengeReplay: mocks.replay
}));

import adRoutes from "../src/routes/ads.routes.js";

describe("rewarded ad routes", () => {
  const app = express();
  app.use(express.json());
  app.use("/", adRoutes);
  app.use((error: { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(error.statusCode ?? 500).json({ error: { code: error.code ?? "internal_error" } });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.start.mockResolvedValue({ sessionId: "2df66b80-77d3-49ac-bf84-27060f3d8e04", status: "started" });
    mocks.replay.mockResolvedValue({ gameKey: "tetris", replayCount: 1 });
    mocks.callback.mockResolvedValue({ accepted: true, duplicate: false });
  });

  it("starts only declared Yandex rewarded placements", async () => {
    await request(app).post("/rewarded/start").send({ placement: "challenge-third-game" }).expect(201);
    await request(app).post("/rewarded/start").send({ placement: "unknown" }).expect(400);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.start).toHaveBeenCalledWith(
      expect.any(Types.ObjectId),
      "challenge-third-game",
      "yandex"
    );
  });

  it("activates a first-game replay only through a verified session", async () => {
    const sessionId = "2df66b80-77d3-49ac-bf84-27060f3d8e04";
    await request(app).post(`/rewarded/${sessionId}/replay`).send({ gameKey: "tetris" }).expect(201);
    expect(mocks.replay).toHaveBeenCalledWith(expect.objectContaining({ sessionId, gameKey: "tetris" }));
  });

});
