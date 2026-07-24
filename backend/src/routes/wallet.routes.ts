import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { ApiError } from "../lib/api-error.js";
import { unitsToCents } from "../lib/money.js";
import { LedgerEntry } from "../models/LedgerEntry.js";
import { User } from "../models/User.js";
import { serializeWallet } from "../services/serialization.service.js";

const router = Router();

router.get("/", async (request, response) => {
  const user = await User.findById(request.auth!.userId).select("wallet");
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  response.json({ data: { wallet: serializeWallet(user.wallet) } });
});

router.get("/ledger", async (request, response) => {
  const query = z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(30),
      cursor: z.string().optional()
    })
    .safeParse(request.query);
  if (!query.success || (query.data.cursor && !Types.ObjectId.isValid(query.data.cursor))) {
    throw new ApiError(400, "validation_error", "Ledger pagination parameters are invalid");
  }

  const entries = await LedgerEntry.find({
    userId: request.auth!.userId,
    ...(query.data.cursor ? { _id: { $lt: new Types.ObjectId(query.data.cursor) } } : {})
  })
    .sort({ _id: -1 })
    .limit(query.data.limit + 1)
    .lean();
  const hasMore = entries.length > query.data.limit;
  const page = hasMore ? entries.slice(0, query.data.limit) : entries;

  response.json({
    data: {
      entries: page.map((entry) => ({
        id: entry._id.toString(),
        type: entry.type,
        amountUnits: entry.amountUnits,
        amountCents: unitsToCents(entry.amountUnits),
        balanceAfterUnits: entry.balanceAfterUnits,
        balanceAfterCents: unitsToCents(entry.balanceAfterUnits),
        description: entry.description,
        metadata: entry.metadata ?? null,
        createdAt: entry.createdAt
      })),
      nextCursor: hasMore ? page.at(-1)?._id.toString() ?? null : null
    }
  });
});

export default router;
