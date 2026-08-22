import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const progressMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn()
}));

vi.mock("../src/models/GameProgress.js", () => ({ GameProgress: progressMocks }));

import gamesRoutes from "../src/routes/games.routes.js";

const gameState = {
  bestScore: 1200,
  previousScore: 900,
  coins: 125,
  lifetimeCoins: 225,
  spentCoins: 80,
  transferredCoins: 20,
  currentLevel: 4,
  highestUnlockedLevel: 5,
  completedLevels: [1, 2, 3, 4],
  selectedCosmetic: "classic",
  unlockedCosmetics: ["classic"],
  bestMovesByLevel: { "1": 4 },
  bestTimesByLevel: { "1": 42000 },
  hintsUsedByLevel: { "1": 0 },
  plays: 5,
  wins: 4,
  lastResult: "level-4",
  updatedAt: 123456
};

describe("game progress routes", () => {
  const userId = new Types.ObjectId();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = { userId, sessionId: new Types.ObjectId().toString() };
    next();
  });
  app.use("/", gamesRoutes);
  app.use((
    error: { statusCode?: number; code?: string },
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    res.status(error.statusCode ?? 500).json({ error: { code: error.code ?? "internal_error" } });
  });

  beforeEach(() => {
    progressMocks.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ games: { longcat: gameState } })
    });
    progressMocks.findOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ games: { longcat: gameState } })
    });
  });

  it("returns saved progress", async () => {
    const response = await request(app).get("/progress").expect(200);
    expect(response.body.data.games.longcat.bestScore).toBe(1200);
    expect(response.body.data.games.longcat.coins).toBe(0);
  });

  it("syncs scores, levels, and skins but strips all client-authored economy", async () => {
    await request(app).put("/progress").send({ games: { longcat: gameState } }).expect(200);
    const safeGameState = {
      ...gameState,
      coins: 0,
      lifetimeCoins: 0,
      spentCoins: 0,
      transferredCoins: 0
    };
    expect(progressMocks.findOneAndUpdate).toHaveBeenCalledWith(
      { userId },
      { $set: { games: { longcat: safeGameState } }, $setOnInsert: { userId } },
      { upsert: true, new: true, runValidators: true }
    );
  });

  it("migrates legacy progress aliases to canonical frontend keys without duplicates", async () => {
    await request(app)
      .put("/progress")
      .send({
        games: {
          "color-focus": { ...gameState, bestScore: 100 },
          tsvet: { ...gameState, bestScore: 200 }
        }
      })
      .expect(200);

    const persistedGames = progressMocks.findOneAndUpdate.mock.calls.at(-1)?.[1].$set.games;
    expect(Object.keys(persistedGames)).toEqual(["tsvet"]);
    expect(persistedGames.tsvet.bestScore).toBe(200);
    expect(persistedGames.tsvet.coins).toBe(0);
  });

  it("rejects malformed progress", async () => {
    await request(app).put("/progress").send({ games: { longcat: { bestScore: -1 } } }).expect(400);
  });

  it("returns 410 and never converts client-authored coins into wallet funds", async () => {
    const response = await request(app)
      .post("/convert")
      .send({ gameId: "longcat", coins: 10_000_000, idempotencyKey: "convert-test-1" })
      .expect(410);
    expect(response.body.error.code).toBe("feature_disabled");
  });
});
