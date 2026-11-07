import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { applyReferralCode, getReferralOverview } from "../services/referral.service.js";

const router = Router();

router.get("/", async (request, response) => {
  const page = z.object({ offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(50).default(6) }).parse(request.query);
  response.json({ data: { referral: await getReferralOverview(request.auth!.userId, undefined, page) } });
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
    const page = z.object({ offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(50).default(6) }).parse(request.query);
  response.json({ data: { referral: await getReferralOverview(request.auth!.userId, undefined, page) } });
  }
);

export default router;
