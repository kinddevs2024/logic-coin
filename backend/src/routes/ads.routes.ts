import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { rewardLimiter } from "../middleware/rate-limits.js";
import { validateBody } from "../middleware/validate.js";
import { REWARDED_AD_PLACEMENTS } from "../models/RewardedAdSession.js";
import {
  claimFirstChallengeReplay,
  claimRewardedAdCoins,
  completeRewardedAdFromClient,
  getRewardedAdSession,
  startRewardedAdSession
} from "../services/rewarded-ad-session.service.js";

const router = Router();
const sessionIdSchema = z.string().uuid();

router.use(requireAuth);

router.post(
  "/rewarded/start",
  rewardLimiter,
  validateBody(
    z.object({
      placement: z.enum(REWARDED_AD_PLACEMENTS),
      provider: z.literal("yandex").default("yandex")
    }).strict()
  ),
  async (request, response) => {
    const body = request.body as {
      placement: (typeof REWARDED_AD_PLACEMENTS)[number];
      provider: "yandex";
    };
    const session = await startRewardedAdSession(request.auth!.userId, body.placement, body.provider);
    response.status(201).json({ data: { session } });
  }
);

router.get("/rewarded/:sessionId", async (request, response) => {
  const sessionId = sessionIdSchema.parse(request.params.sessionId);
  const session = await getRewardedAdSession(request.auth!.userId, sessionId);
  response.json({ data: { session } });
});

router.post(
  "/rewarded/:sessionId/complete",
  rewardLimiter,
  validateBody(z.object({ clientReceiptId: z.string().trim().min(16).max(180) }).strict()),
  async (request, response) => {
    const sessionId = sessionIdSchema.parse(request.params.sessionId);
    const body = request.body as { clientReceiptId: string };
    const session = await completeRewardedAdFromClient({
      userId: request.auth!.userId,
      sessionId,
      clientReceiptId: body.clientReceiptId
    });
    response.json({ data: { session } });
  }
);

router.post("/rewarded/:sessionId/claim", rewardLimiter, async (request, response) => {
  const sessionId = sessionIdSchema.parse(request.params.sessionId);
  const result = await claimRewardedAdCoins({ userId: request.auth!.userId, sessionId });
  response.status(result.idempotentReplay ? 200 : 201).json({ data: result });
});

router.post(
  "/rewarded/:sessionId/replay",
  rewardLimiter,
  validateBody(z.object({ gameKey: z.string().trim().min(1).max(80) }).strict()),
  async (request, response) => {
    const sessionId = sessionIdSchema.parse(request.params.sessionId);
    const body = request.body as { gameKey: string };
    const effect = await claimFirstChallengeReplay({
      userId: request.auth!.userId,
      sessionId,
      gameKey: body.gameKey
    });
    response.status(201).json({ data: { effect } });
  }
);

export default router;
