import express from "express";
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
  });

  it("validates and upserts per-game progress", async () => {
    await request(app).put("/progress").send({ games: { longcat: gameState } }).expect(200);
    expect(progressMocks.findOneAndUpdate).toHaveBeenCalledWith(
      { userId },
      { $set: { games: { longcat: gameState } }, $setOnInsert: { userId } },
      { upsert: true, new: true, runValidators: true }
    );
  });

  it("rejects malformed progress", async () => {
    await request(app).put("/progress").send({ games: { longcat: { bestScore: -1 } } }).expect(400);
  });

  it("requires conversion amounts divisible by ten", async () => {
    await request(app)
      .post("/convert")
      .send({ gameId: "longcat", coins: 11, idempotencyKey: "convert-test-1" })
      .expect(400);
  });
});
