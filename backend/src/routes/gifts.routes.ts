import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { listGifts, useGift } from "../services/gift.service.js";

const router = Router();

router.get("/", async (request, response) => {
  response.json({ data: { gifts: await listGifts(request.auth!.userId) } });
});

router.post(
  "/:giftId/use",
  validateBody(
    z
      .object({ gameKey: z.string().trim().regex(/^[a-z0-9-]{1,80}$/).optional() })
      .strict()
  ),
  async (request, response) => {
    const body = request.body as { gameKey?: string };
    const result = await useGift({
      userId: request.auth!.userId,
      giftId: String(request.params.giftId),
      ...(body.gameKey ? { gameKey: body.gameKey } : {})
    });
    response.json({ data: result });
  }
);

export default router;
