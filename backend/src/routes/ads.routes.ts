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
  startRewardedAdSession,
  verifyAppodealServerCallback
} from "../services/rewarded-ad-session.service.js";

const router = Router();
const sessionIdSchema = z.string().uuid();

router.get("/appodeal/reward", async (request, response) => {
  const query = z
    .object({ data1: z.string().regex(/^[a-f0-9]+$/i), data2: z.string().regex(/^[a-f0-9]+$/i) })
    .safeParse(request.query);
  if (!query.success) {
    response.status(400).json({ error: { code: "invalid_appodeal_callback" } });
    return;
  }
  const result = await verifyAppodealServerCallback(query.data.data1, query.data.data2);
  response.json({ data: result });
});

router.use(requireAuth);

router.post(
  "/rewarded/start",
  rewardLimiter,
  validateBody(z.object({ placement: z.enum(REWARDED_AD_PLACEMENTS) }).strict()),
  async (request, response) => {
    const body = request.body as { placement: (typeof REWARDED_AD_PLACEMENTS)[number] };
    const session = await startRewardedAdSession(request.auth!.userId, body.placement);
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
