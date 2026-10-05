import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../lib/api-error.js";
import { getLeaderboard, getLeaderboards } from "../services/leaderboard.service.js";

const router = Router();

router.get("/", async (request, response) => {
  const query = z
    .object({
      metric: z.enum(["all", "wealth", "wallet", "coins", "lifetime"]).default("wealth"),
      limit: z.coerce.number().int().min(1).max(50).default(50),
      offset: z.coerce.number().int().min(0).default(0)
    })
    .safeParse(request.query);
  if (!query.success) {
    throw new ApiError(400, "validation_error", "Leaderboard query is invalid", query.error.flatten());
  }
  const data = query.data.metric === "all"
    ? await getLeaderboards({
        userId: request.auth!.userId,
        limit: query.data.limit,
        offset: query.data.offset
      })
    : await getLeaderboard({
      userId: request.auth!.userId,
      metric: query.data.metric,
      limit: query.data.limit,
      offset: query.data.offset
    });
  response.json({ data });
});

export default router;
