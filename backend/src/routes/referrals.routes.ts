import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { applyReferralCode, getReferralOverview } from "../services/referral.service.js";

const router = Router();

router.get("/", async (request, response) => {
  response.json({ data: { referral: await getReferralOverview(request.auth!.userId) } });
});

router.post(
  "/apply",
  validateBody(
    z
      .object({
        code: z.string().trim().min(4).max(32)
      })
      .strict()
  ),
  async (request, response) => {
    const { code } = request.body as { code: string };
    await applyReferralCode(request.auth!.userId, code);
    response.json({ data: { referral: await getReferralOverview(request.auth!.userId) } });
  }
);

export default router;
