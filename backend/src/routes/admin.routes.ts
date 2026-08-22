import { Router } from "express";
import { z } from "zod";
import { addDays, daysBetween, parseDayKey } from "../lib/date.js";
import { ApiError } from "../lib/api-error.js";
import { canonicalGameKey } from "../lib/game-key.js";
import { requireAdminToken } from "../middleware/admin.js";
import { authLimiter } from "../middleware/rate-limits.js";
import { validateBody } from "../middleware/validate.js";
import { Game } from "../models/Game.js";
import { authenticateAdminPassword } from "../services/admin-auth.service.js";
import {
  configureDailyChallenge,
  getAdminAnalytics,
  getAdminDailyChallenge,
  getAdminOverview,
  getBudgetAnalytics,
  listAdminDailyChallenges,
  listAdminGames,
  recordBudgetEntry
} from "../services/admin.service.js";
import { settleDailyContest } from "../services/contest.service.js";
import { challengeDayKey } from "../services/daily-challenge.service.js";
import { serializeGame } from "../services/serialization.service.js";

const router = Router();

const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  try {
    parseDayKey(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid calendar day");

router.post(
  "/auth",
  authLimiter,
  validateBody(z.object({ password: z.string().min(1).max(128) }).strict()),
  async (request, response) => {
    const { password } = request.body as { password: string };
    response.json({ data: await authenticateAdminPassword(password) });
  }
);

router.use(requireAdminToken);

const localizedTextSchema = z
  .object({
    en: z.string().trim().min(1).max(120),
    ru: z.string().trim().min(1).max(120),
    uz: z.string().trim().min(1).max(120)
  })
  .strict();

const gameCreateSchema = z
  .object({
    key: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{1,80}$/)
      .refine((value) => canonicalGameKey(value) === value, "Use the canonical game key"),
    slug: z.string().trim().regex(/^[a-z0-9-]{1,80}$/),
    title: localizedTextSchema,
    description: localizedTextSchema,
    icon: z.string().trim().min(1).max(80),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    engine: z.enum(["native", "webview"]),
    clientPath: z.string().trim().max(240).optional(),
    assetPath: z.string().trim().max(240).optional(),
    enabled: z.boolean().default(true),
    challengeEnabled: z.boolean().default(true),
    practiceEnabled: z.boolean().default(true),
    sortOrder: z.number().int().min(-100_000).max(100_000).default(0),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    scoring: z
      .object({
        higherIsBetter: z.boolean().default(true),
        maxCoins: z.number().int().min(1).max(1_000).default(1_000)
      })
      .strict()
      .default({ higherIsBetter: true, maxCoins: 1_000 })
  })
  .strict();

router.get("/games", async (_request, response) => {
  response.json({ data: { games: await listAdminGames() } });
});

router.post("/games", validateBody(gameCreateSchema), async (request, response) => {
  const game = await Game.create(request.body as z.infer<typeof gameCreateSchema>);
  response.status(201).json({ data: { game: serializeGame(game, "ru") } });
});

const gamePatchSchema = gameCreateSchema
  .omit({ key: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

router.patch("/games/:gameKey", validateBody(gamePatchSchema), async (request, response) => {
  const gameKey = z.string().regex(/^[a-z0-9-]{1,80}$/).safeParse(request.params.gameKey);
  if (!gameKey.success) throw new ApiError(400, "invalid_game_key", "Game key is invalid");
  const game = await Game.findOneAndUpdate(
    { key: gameKey.data },
    { $set: request.body as z.infer<typeof gamePatchSchema> },
    { new: true, runValidators: true }
  );
  if (!game) throw new ApiError(404, "game_not_found", "Game not found");
  response.json({ data: { game: serializeGame(game, "ru") } });
});

router.get("/overview", async (request, response) => {
  const parsed = request.query.dayKey
    ? dayKeySchema.safeParse(request.query.dayKey)
    : { success: true as const, data: challengeDayKey() };
  if (!parsed.success) throw new ApiError(400, "invalid_day_key", "dayKey is invalid");
  response.json({ data: await getAdminOverview(parsed.data) });
});

router.get("/daily-challenges", async (request, response) => {
  const fallbackTo = challengeDayKey();
  const from = dayKeySchema.safeParse(request.query.from ?? addDays(fallbackTo, -29));
  const to = dayKeySchema.safeParse(request.query.to ?? fallbackTo);
  if (
    !from.success ||
    !to.success ||
    from.data > to.data ||
    daysBetween(from.data, to.data) > 365
  ) {
    throw new ApiError(400, "invalid_date_range", "A valid from/to day range is required");
  }
  response.json({ data: { challenges: await listAdminDailyChallenges(from.data, to.data) } });
});

router.get("/daily-challenges/:dayKey", async (request, response) => {
  const dayKey = dayKeySchema.safeParse(request.params.dayKey);
  if (!dayKey.success) throw new ApiError(400, "invalid_day_key", "Day key is invalid");
  response.json({ data: { challenge: await getAdminDailyChallenge(dayKey.data) } });
});

const dailyChallengeSchema = z
  .object({
    selectionMode: z.enum(["manual", "random"]).default("manual"),
    gameKeys: z.array(z.string().trim().regex(/^[a-z0-9-]{1,80}$/)).length(6).optional(),
    cashPrizeMinUnits: z.number().int().min(0).max(100_000_000),
    cashPrizeMaxUnits: z.number().int().min(0).max(100_000_000),
    prizePoolUnits: z.number().int().min(0).max(1_000_000_000),
    maxAttemptsPerGame: z.number().int().min(1).max(100).optional(),
    oneSecondAttemptLimit: z.number().int().min(1).max(100).optional(),
    publish: z.boolean().default(false)
  })
  .strict()
  .superRefine((value, context) => {
    if (value.selectionMode === "manual" && value.gameKeys?.length !== 6) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gameKeys"],
        message: "Manual selection requires exactly six game keys"
      });
    }
  });

router.put(
  "/daily-challenges/:dayKey",
  validateBody(dailyChallengeSchema),
  async (request, response) => {
    const dayKey = dayKeySchema.safeParse(request.params.dayKey);
    if (!dayKey.success) throw new ApiError(400, "invalid_day_key", "Day key is invalid");
    const body = request.body as z.infer<typeof dailyChallengeSchema>;
    const result = await configureDailyChallenge({
      dayKey: dayKey.data,
      adminSubject: request.adminAuth!.subject,
      selectionMode: body.selectionMode,
      ...(body.gameKeys ? { gameKeys: body.gameKeys } : {}),
      cashPrizeMinUnits: body.cashPrizeMinUnits,
      cashPrizeMaxUnits: body.cashPrizeMaxUnits,
      prizePoolUnits: body.prizePoolUnits,
      maxAttemptsPerGame: body.maxAttemptsPerGame ?? 1,
      oneSecondAttemptLimit: body.oneSecondAttemptLimit ?? 20,
      publish: body.publish
    });
    response.json({ data: result });
  }
);

router.post("/daily-challenges/:dayKey/settle", async (request, response) => {
  const dayKey = dayKeySchema.safeParse(request.params.dayKey);
  if (!dayKey.success) throw new ApiError(400, "invalid_day_key", "Day key is invalid");
  const result = await settleDailyContest(dayKey.data);
  response.status(result.alreadySettled ? 200 : 201).json({ data: result });
});

router.get("/analytics", async (request, response) => {
  const dayKey = dayKeySchema.safeParse(request.query.dayKey ?? challengeDayKey());
  if (!dayKey.success) throw new ApiError(400, "invalid_day_key", "dayKey is invalid");
  response.json({ data: await getAdminAnalytics(dayKey.data) });
});

router.get("/budget", async (request, response) => {
  const days = z.coerce.number().int().min(1).max(366).safeParse(request.query.days ?? 30);
  if (!days.success) throw new ApiError(400, "invalid_days", "days must be between 1 and 366");
  response.json({ data: await getBudgetAnalytics(days.data) });
});

const budgetEntrySchema = z
  .object({
    dayKey: dayKeySchema,
    type: z.enum(["ad_revenue", "other_revenue", "operating_expense"]),
    amountUnits: z.number().int().min(1).max(1_000_000_000),
    sourceId: z.string().trim().min(1).max(180),
    description: z.string().trim().min(1).max(240).optional()
  })
  .strict();

router.post("/budget/entries", validateBody(budgetEntrySchema), async (request, response) => {
  const body = request.body as z.infer<typeof budgetEntrySchema>;
  const entry = await recordBudgetEntry({
    dayKey: body.dayKey,
    type: body.type,
    amountUnits: body.amountUnits,
    sourceId: body.sourceId,
    ...(body.description ? { description: body.description } : {})
  });
  response.status(201).json({ data: { entry } });
});

export default router;
