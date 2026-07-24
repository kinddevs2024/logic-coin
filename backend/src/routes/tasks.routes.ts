import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../lib/api-error.js";
import { rewardLimiter } from "../middleware/rate-limits.js";
import { validateBody } from "../middleware/validate.js";
import { claimTask, listTasksForUser } from "../services/task.service.js";
import { unitsToCents } from "../lib/money.js";

const router = Router();

router.get("/", async (request, response) => {
  const tasks = await listTasksForUser(request.auth!.userId);
  response.json({ data: { tasks } });
});

router.post(
  "/:taskIdentifier/claim",
  rewardLimiter,
  validateBody(
    z
      .object({
        idempotencyKey: z.string().trim().min(8).max(160).optional()
      })
      .strict()
  ),
  async (request, response) => {
    const taskIdentifier = z.string().trim().min(1).max(160).safeParse(request.params.taskIdentifier);
    if (!taskIdentifier.success) {
      throw new ApiError(400, "invalid_task_identifier", "Task identifier is invalid");
    }
    const body = request.body as { idempotencyKey?: string };
    const headerKey = request.header("idempotency-key");
    const idempotencyKey = body.idempotencyKey ?? headerKey;
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 160) {
      throw new ApiError(
        400,
        "idempotency_key_required",
        "Provide an Idempotency-Key header or idempotencyKey body field"
      );
    }

    const result = await claimTask({
      userId: request.auth!.userId,
      taskIdentifier: taskIdentifier.data,
      idempotencyKey
    });
    response.status(result.idempotentReplay ? 200 : 201).json({
      data: {
        claim: {
          id: result.claim._id.toString(),
          taskKey: result.claim.taskKey,
          rewardUnits: result.claim.rewardUnits,
          rewardCents: unitsToCents(result.claim.rewardUnits),
          status: result.claim.status,
          claimedAt: result.claim.claimedAt,
          idempotencyKey: result.claim.idempotencyKey,
          idempotentReplay: result.idempotentReplay
        },
        wallet: result.wallet
      }
    });
  }
);

export default router;
