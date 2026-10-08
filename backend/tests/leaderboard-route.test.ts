import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";

const leaderboardMock = vi.hoisted(() => vi.fn());
vi.mock("../src/services/leaderboard.service.js", () => ({
  getLeaderboard: leaderboardMock
}));

import leaderboardRoutes from "../src/routes/leaderboard.routes.js";

describe("leaderboard route", () => {
  const userId = new Types.ObjectId();
  const app = express();
  app.use((req, _res, next) => {
    req.auth = { userId, sessionId: new Types.ObjectId().toString() };
    next();
  });
  app.use("/", leaderboardRoutes);
  app.use((
    error: { statusCode?: number; code?: string },
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    res.status(error.statusCode ?? 500).json({ error: { code: error.code ?? "internal_error" } });
  });

  it("accepts metric and limit and returns the current user's rank", async () => {
    leaderboardMock.mockResolvedValueOnce({
      metric: "coins",
      total: 100,
      entries: [],
      self: { rank: 42, userId: userId.toString() }
    });
    const response = await request(app).get("/?metric=coins&limit=20").expect(200);
    expect(leaderboardMock).toHaveBeenCalledWith({ userId, metric: "coins", limit: 20 });
    expect(response.body.data.self.rank).toBe(42);
  });

  it("rejects unsupported metrics and excessive limits", async () => {
    await request(app).get("/?metric=unknown").expect(400);
    await request(app).get("/?limit=101").expect(400);
  });
});
