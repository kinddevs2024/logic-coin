import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../lib/api-error.js";
import { canonicalGameKey } from "../lib/game-key.js";
import { validateBody } from "../middleware/validate.js";
import { GameProgress } from "../models/GameProgress.js";
import { listGamesForUser } from "../services/game.service.js";

const router = Router();

router.get("/", async (request, response) => {
  const games = await listGamesForUser(request.auth!.userId);
  response.json({ data: { games } });
});

const gameStateSchema = z
  .object({
    bestScore: z.number().int().min(0).max(1_000_000_000),
    previousScore: z.number().int().min(0).max(1_000_000_000),
    // Accepted for legacy-client compatibility, but never trusted or persisted.
    coins: z.number().int().min(0).max(1_000_000_000).optional(),
    lifetimeCoins: z.number().int().min(0).max(1_000_000_000).optional(),
    spentCoins: z.number().int().min(0).max(1_000_000_000).optional(),
    transferredCoins: z.number().int().min(0).max(1_000_000_000).optional(),
    currentLevel: z.number().int().min(1).max(10_000),
    highestUnlockedLevel: z.number().int().min(1).max(10_000),
    completedLevels: z.array(z.number().int().min(1).max(10_000)).max(10_000),
    selectedCosmetic: z.string().trim().min(1).max(80),
    unlockedCosmetics: z.array(z.string().trim().min(1).max(80)).max(100),
    bestMovesByLevel: z.record(z.string(), z.number().int().min(0).max(1_000_000)),
    bestTimesByLevel: z.record(z.string(), z.number().int().min(0).max(86_400_000)).optional(),
    hintsUsedByLevel: z.record(z.string(), z.number().int().min(0).max(100)).optional(),
    plays: z.number().int().min(0).max(1_000_000_000),
    wins: z.number().int().min(0).max(1_000_000_000),
    lastResult: z.string().max(160),
    updatedAt: z.number().int().min(0)
  })
  .strict();

const progressSchema = z
  .object({
    games: z.record(z.string().regex(/^[a-z0-9-]{1,40}$/), gameStateSchema)
  })
  .strict()
  .refine((value) => Object.keys(value.games).length <= 32, "Too many game entries");

type ClientGameState = z.infer<typeof gameStateSchema>;

function withoutClientEconomy(state: ClientGameState | Record<string, unknown>) {
  return {
    ...state,
    coins: 0,
    lifetimeCoins: 0,
    spentCoins: 0,
    transferredCoins: 0
  };
}

function canonicalizeProgressGames(gamesValue: unknown): Record<string, Record<string, unknown>> {
  const games =
    gamesValue && typeof gamesValue === "object"
      ? (gamesValue as Record<string, Record<string, unknown>>)
      : {};
  // Legacy aliases are applied first so an explicit canonical record always wins.
  return Object.fromEntries(
    Object.entries(games)
      .sort(([first], [second]) => {
        const firstCanonical = canonicalGameKey(first) === first ? 1 : 0;
        const secondCanonical = canonicalGameKey(second) === second ? 1 : 0;
        return firstCanonical - secondCanonical;
      })
      .map(([gameKey, state]) => [canonicalGameKey(gameKey), withoutClientEconomy(state)])
  );
}

router.get("/progress", async (request, response) => {
  const progress = await GameProgress.findOne({ userId: request.auth!.userId }).lean();
  response.json({ data: { games: canonicalizeProgressGames(progress?.games) } });
});

router.put(
  "/progress",
  validateBody(progressSchema),
  async (request, response) => {
    const input = request.body as z.infer<typeof progressSchema>;
    const safeGames = canonicalizeProgressGames(input.games);
    const progress = await GameProgress.findOneAndUpdate(
      { userId: request.auth!.userId },
      {
        $set: { games: safeGames },
        $setOnInsert: { userId: request.auth!.userId }
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();
    response.json({ data: { games: canonicalizeProgressGames(progress.games) } });
  }
);

router.post("/convert", () => {
  throw new ApiError(
    410,
    "feature_disabled",
    "Legacy game coin conversion is disabled; only server-issued rewards can affect the wallet"
  );
});

export default router;
