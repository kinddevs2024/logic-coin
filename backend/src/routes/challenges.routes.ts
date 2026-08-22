import { Router } from "express";
import { z } from "zod";
import { MAX_CHALLENGE_DURATION_MS, MAX_CHALLENGE_SCORE } from "../config/constants.js";
import { ApiError } from "../lib/api-error.js";
import { rewardLimiter } from "../middleware/rate-limits.js";
import { validateBody } from "../middleware/validate.js";
import {
  completeChallengeAttempt,
  completePracticeAttempt,
  doubleChallengeCoins,
  startChallengeAttempt
} from "../services/challenge-attempt.service.js";
import { getContestResultForUser } from "../services/contest.service.js";
import { getTodayChallengeOverview } from "../services/daily-challenge.service.js";

const router = Router();
const gameKeySchema = z.string().trim().regex(/^[a-z0-9-]{1,80}$/);
const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

router.get("/today", async (request, response) => {
  response.json({ data: { today: await getTodayChallengeOverview(request.auth!.userId) } });
});

router.get("/results/:dayKey", async (request, response) => {
  const dayKey = dayKeySchema.safeParse(request.params.dayKey);
  if (!dayKey.success) throw new ApiError(400, "invalid_day_key", "Day key is invalid");
  const result = await getContestResultForUser(dayKey.data, request.auth!.userId);
  response.json({ data: { result } });
});

router.post("/:gameKey/start", async (request, response) => {
  const gameKey = gameKeySchema.safeParse(request.params.gameKey);
  if (!gameKey.success) throw new ApiError(400, "invalid_game_key", "Game key is invalid");
  const attempt = await startChallengeAttempt({
    userId: request.auth!.userId,
    gameKey: gameKey.data
  });
  response.status(attempt.resumed ? 200 : 201).json({ data: attempt });
});

const completeSchema = z
  .object({
    score: z.number().int().min(0).max(MAX_CHALLENGE_SCORE),
    durationMs: z.number().int().min(0).max(MAX_CHALLENGE_DURATION_MS).optional()
  })
  .strict();

router.post(
  "/:gameKey/complete",
  rewardLimiter,
  validateBody(completeSchema),
  async (request, response) => {
    const gameKey = gameKeySchema.safeParse(request.params.gameKey);
    if (!gameKey.success) throw new ApiError(400, "invalid_game_key", "Game key is invalid");
    const body = request.body as z.infer<typeof completeSchema>;
    const result = await completeChallengeAttempt({
      userId: request.auth!.userId,
      gameKey: gameKey.data,
      score: body.score,
      ...(body.durationMs !== undefined ? { durationMs: body.durationMs } : {})
    });
    response.status(result.attempt.idempotentReplay ? 200 : 201).json({ data: result });
  }
);

router.post(
  "/double",
  rewardLimiter,
  validateBody(
    z
      .object({
        scope: z.enum(["game", "day"]),
        ad: z
          .object({
            provider: z.enum(["demo", "applovin-max"]).optional(),
            receiptId: z.string().trim().min(1).max(180).optional()
          })
          .strict()
          .optional()
      })
      .strict()
  ),
  async (request, response) => {
    const body = request.body as {
      scope: "game" | "day";
      ad?: { provider?: "demo" | "applovin-max"; receiptId?: string };
    };
    const result = await doubleChallengeCoins({
      userId: request.auth!.userId,
      scope: body.scope,
      ...(body.ad ? { ad: body.ad } : {})
    });
    response.status(result.idempotentReplay ? 200 : 201).json({ data: result });
  }
);

router.post(
  "/practice/:gameKey/complete",
  rewardLimiter,
  validateBody(completeSchema),
  async (request, response) => {
    const gameKey = gameKeySchema.safeParse(request.params.gameKey);
    if (!gameKey.success) throw new ApiError(400, "invalid_game_key", "Game key is invalid");
    const body = request.body as z.infer<typeof completeSchema>;
    const result = await completePracticeAttempt({
      userId: request.auth!.userId,
      gameKey: gameKey.data,
      score: body.score,
      ...(body.durationMs !== undefined ? { durationMs: body.durationMs } : {})
    });
    response.status(201).json({ data: result });
  }
);

export default router;
