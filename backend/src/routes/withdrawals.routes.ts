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
      processingTimeHours: 12,
      minimumCents: env.MIN_WITHDRAWAL_CENTS,
      eligible: wallet.availableCents >= env.MIN_WITHDRAWAL_CENTS,
      wallet,
      withdrawals: withdrawals.map((withdrawal) => ({
        id: withdrawal._id.toString(),
        amountCents: withdrawal.amountCents,
        amountUnits: withdrawal.amountUnits,
        method: withdrawal.method,
        accountLabel: withdrawal.accountLabel ?? null,
        cardBrand: withdrawal.cardBrand ?? null,
        cardLast4: withdrawal.cardLast4 ?? null,
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
    method: z.literal("bank_card"),
    card: z.object({
      brand: z.enum(["visa", "mastercard", "other"]),
      last4: z.string().regex(/^\d{4}$/),
      holderName: z.string().trim().min(2).max(80),
      expiration: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/)
    }).strict(),
    agreementAccepted: z.literal(true),
    agreementVersion: z.literal("2026-08-23"),
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
      card: input.card,
      agreementVersion: input.agreementVersion
    });
    const notification = result.idempotentReplay
      ? "not_repeated"
      : await notifyWithdrawalAdmin({
          withdrawalId: result.withdrawal._id.toString(),
          userId: request.auth!.userId.toString(),
          amountCents: result.withdrawal.amountCents,
          accountLabel: result.withdrawal.accountLabel ?? "Bank card"
        });

    response.status(result.idempotentReplay ? 200 : 201).json({
      data: {
        sandbox: true,
        withdrawal: {
          id: result.withdrawal._id.toString(),
          amountCents: result.withdrawal.amountCents,
          amountUnits: result.withdrawal.amountUnits,
          method: result.withdrawal.method,
          accountLabel: result.withdrawal.accountLabel ?? null,
          cardBrand: result.withdrawal.cardBrand ?? null,
          cardLast4: result.withdrawal.cardLast4 ?? null,
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
