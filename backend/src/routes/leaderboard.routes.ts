import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../lib/api-error.js";
import { getLeaderboard } from "../services/leaderboard.service.js";

const router = Router();

router.get("/", async (request, response) => {
  const query = z
    .object({
      metric: z.enum(["wealth", "wallet", "coins", "lifetime"]).default("wealth"),
      limit: z.coerce.number().int().min(1).max(100).default(50)
    })
    .safeParse(request.query);
  if (!query.success) {
    throw new ApiError(400, "validation_error", "Leaderboard query is invalid", query.error.flatten());
  }
  response.json({
    data: await getLeaderboard({
      userId: request.auth!.userId,
      metric: query.data.metric,
      limit: query.data.limit
    })
  });
});

export default router;
