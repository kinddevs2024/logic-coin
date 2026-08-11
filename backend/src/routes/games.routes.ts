import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { ApiError } from "../lib/api-error.js";
import { rewardLimiter } from "../middleware/rate-limits.js";
import { validateBody } from "../middleware/validate.js";
import { GameProgress } from "../models/GameProgress.js";
import { LedgerEntry } from "../models/LedgerEntry.js";
import { User } from "../models/User.js";
import { serializeWallet } from "../services/serialization.service.js";
import { creditReward } from "../services/wallet.service.js";

const router = Router();

const gameStateSchema = z
  .object({
    bestScore: z.number().int().min(0).max(1_000_000_000),
    previousScore: z.number().int().min(0).max(1_000_000_000),
    coins: z.number().int().min(0).max(1_000_000_000),
    lifetimeCoins: z.number().int().min(0).max(1_000_000_000),
    spentCoins: z.number().int().min(0).max(1_000_000_000),
    transferredCoins: z.number().int().min(0).max(1_000_000_000),
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
  .refine((value) => Object.keys(value.games).length <= 20, "Too many game entries");

const conversionSchema = z
  .object({
    gameId: z.string().regex(/^[a-z0-9-]{1,40}$/),
    coins: z.number().int().min(10).max(10_000).refine((value) => value % 10 === 0),
    idempotencyKey: z.string().trim().min(8).max(120)
  })
  .strict();

router.get("/progress", async (request, response) => {
  const progress = await GameProgress.findOne({ userId: request.auth!.userId }).lean();
  response.json({ data: { games: progress?.games ?? {} } });
});

router.put(
  "/progress",
  validateBody(progressSchema),
  async (request, response) => {
    const input = request.body as z.infer<typeof progressSchema>;
    const progress = await GameProgress.findOneAndUpdate(
      { userId: request.auth!.userId },
      {
        $set: { games: input.games },
        $setOnInsert: { userId: request.auth!.userId }
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();
    response.json({ data: { games: progress.games } });
  }
);

router.post(
  "/convert",
  rewardLimiter,
  validateBody(conversionSchema),
  async (request, response) => {
    const input = request.body as z.infer<typeof conversionSchema>;
    const sourceId = `game:${input.gameId}:${input.idempotencyKey}`;
    const existing = await LedgerEntry.findOne({
      userId: request.auth!.userId,
      type: "game_reward",
      sourceId
    }).lean();
    if (existing) {
      const [user, progress] = await Promise.all([
        User.findById(request.auth!.userId).select("wallet").lean(),
        GameProgress.findOne({ userId: request.auth!.userId }).lean()
      ]);
      if (!user) throw new ApiError(404, "user_not_found", "User not found");
      response.json({
        data: {
          convertedUnits: existing.amountUnits,
          games: progress?.games ?? {},
          wallet: serializeWallet(user.wallet),
          idempotentReplay: true
        }
      });
      return;
    }

    const session = await mongoose.startSession();
    let result: { convertedUnits: number; games: Record<string, unknown>; wallet: ReturnType<typeof serializeWallet> } | undefined;
    try {
      await session.withTransaction(async () => {
        const progress = await GameProgress.findOne({ userId: request.auth!.userId }).session(session);
        const games = (progress?.games ?? {}) as Record<string, Record<string, unknown>>;
        const current = games[input.gameId];
        const availableCoins = Number(current?.coins ?? 0);
        if (!progress || !current || !Number.isSafeInteger(availableCoins) || availableCoins < input.coins) {
          throw new ApiError(409, "insufficient_game_coins", "Not enough game coins");
        }

        const convertedUnits = input.coins / 10;
        const nextGame = {
          ...current,
          coins: availableCoins - input.coins,
          transferredCoins: Number(current.transferredCoins ?? 0) + input.coins,
          updatedAt: Date.now()
        };
        const nextGames = { ...games, [input.gameId]: nextGame };
        progress.set("games", nextGames);
        progress.markModified("games");
        await progress.save({ session });

        await creditReward(
          {
            userId: request.auth!.userId,
            amountUnits: convertedUnits,
            type: "game_reward",
            sourceId,
            description: `Game coin conversion: ${input.gameId}`,
            metadata: { gameId: input.gameId, coins: input.coins }
          },
          session
        );
        const user = await User.findById(request.auth!.userId).select("wallet").session(session);
        if (!user) throw new ApiError(404, "user_not_found", "User not found");
        result = { convertedUnits, games: nextGames, wallet: serializeWallet(user.wallet) };
      });
    } finally {
      await session.endSession();
    }

    if (!result) throw new ApiError(500, "game_conversion_failed", "Game coin conversion failed");
    response.status(201).json({ data: { ...result, idempotentReplay: false } });
  }
);

export default router;
