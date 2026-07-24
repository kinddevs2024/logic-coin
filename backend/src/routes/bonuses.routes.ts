import { Router } from "express";
import { z } from "zod";
import { rewardLimiter } from "../middleware/rate-limits.js";
import { claimBonus, getBonusOverview } from "../services/bonus.service.js";
import { unitsToCents } from "../lib/money.js";
import { ApiError } from "../lib/api-error.js";

const router = Router();

router.get("/", async (request, response) => {
  const bonuses = await getBonusOverview(request.auth!.userId);
  response.json({ data: { bonuses } });
});

router.post("/:kind/claim", rewardLimiter, async (request, response) => {
  const kind = z.enum(["daily", "weekly", "monthly"]).safeParse(request.params.kind);
  if (!kind.success) {
    throw new ApiError(400, "invalid_bonus_kind", "Bonus kind is invalid");
  }
  const result = await claimBonus(request.auth!.userId, kind.data);
  response.status(result.idempotentReplay ? 200 : 201).json({
    data: {
      claim: {
        id: result.claim._id.toString(),
        key: result.claim.key,
        kind: result.claim.kind,
        rewardUnits: result.claim.rewardUnits,
        rewardCents: unitsToCents(result.claim.rewardUnits),
        claimedAt: result.claim.claimedAt,
        idempotentReplay: result.idempotentReplay
      },
      wallet: result.wallet
    }
  });
});

export default router;
