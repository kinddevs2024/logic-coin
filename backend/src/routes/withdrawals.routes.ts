import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { withdrawalLimiter } from "../middleware/rate-limits.js";
import { validateBody } from "../middleware/validate.js";
import { User } from "../models/User.js";
import { Withdrawal } from "../models/Withdrawal.js";
import { serializeWallet } from "../services/serialization.service.js";
import { notifyWithdrawalAdmin } from "../services/telegram.service.js";
import { createSandboxWithdrawal } from "../services/withdrawal.service.js";

const router = Router();

router.get("/", async (request, response) => {
  const [user, withdrawals] = await Promise.all([
    User.findById(request.auth!.userId).select("wallet"),
    Withdrawal.find({ userId: request.auth!.userId }).sort({ requestedAt: -1 }).limit(100).lean()
  ]);
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  const wallet = serializeWallet(user.wallet);
  response.json({
    data: {
      sandbox: true,
      minimumCents: env.MIN_WITHDRAWAL_CENTS,
      eligible: wallet.availableCents >= env.MIN_WITHDRAWAL_CENTS,
      wallet,
      withdrawals: withdrawals.map((withdrawal) => ({
        id: withdrawal._id.toString(),
        amountCents: withdrawal.amountCents,
        amountUnits: withdrawal.amountUnits,
        method: withdrawal.method,
        accountLabel: withdrawal.accountLabel ?? null,
        status: withdrawal.status,
        requestedAt: withdrawal.requestedAt,
        processedAt: withdrawal.processedAt ?? null
      }))
    }
  });
});

const createWithdrawalSchema = z
  .object({
    amountCents: z.number().int().positive(),
    method: z.literal("sandbox").default("sandbox"),
    accountLabel: z.string().trim().min(1).max(120).optional(),
    idempotencyKey: z.string().trim().min(8).max(160).optional()
  })
  .strict();

router.post(
  "/",
  withdrawalLimiter,
  validateBody(createWithdrawalSchema),
  async (request, response) => {
    const input = request.body as z.infer<typeof createWithdrawalSchema>;
    const idempotencyKey = input.idempotencyKey ?? request.header("idempotency-key");
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 160) {
      throw new ApiError(
        400,
        "idempotency_key_required",
        "Provide an Idempotency-Key header or idempotencyKey body field"
      );
    }
    const result = await createSandboxWithdrawal({
      userId: request.auth!.userId,
      amountCents: input.amountCents,
      idempotencyKey,
      ...(input.accountLabel ? { accountLabel: input.accountLabel } : {})
    });
    const notification = result.idempotentReplay
      ? "not_repeated"
      : await notifyWithdrawalAdmin({
          withdrawalId: result.withdrawal._id.toString(),
          userId: request.auth!.userId.toString(),
          amountCents: result.withdrawal.amountCents
        });

    response.status(result.idempotentReplay ? 200 : 201).json({
      data: {
        sandbox: true,
        withdrawal: {
          id: result.withdrawal._id.toString(),
          amountCents: result.withdrawal.amountCents,
          amountUnits: result.withdrawal.amountUnits,
          method: result.withdrawal.method,
          status: result.withdrawal.status,
          requestedAt: result.withdrawal.requestedAt,
          idempotentReplay: result.idempotentReplay
        },
        wallet: result.wallet,
        adminNotification: notification
      }
    });
  }
);

export default router;
