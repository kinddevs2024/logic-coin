import mongoose, { Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { Withdrawal } from "../models/Withdrawal.js";
import { User } from "../models/User.js";
import { LedgerEntry } from "../models/LedgerEntry.js";

export const withdrawalStatuses = ["pending_review", "approved", "paid", "rejected", "sandbox_pending", "sandbox_completed"] as const;
export type WithdrawalStatus = typeof withdrawalStatuses[number];
export type WithdrawalAction = "approve" | "reject" | "mark_paid";
export async function listAdminWithdrawals(input: { status?: WithdrawalStatus; before?: string; limit: number }) {
  const filter = { ...(input.status ? { status: input.status } : {}), ...(input.before ? { _id: { $lt: new Types.ObjectId(input.before) } } : {}) };
  const [rows, summary] = await Promise.all([
    Withdrawal.find(filter).sort({ _id: -1 }).limit(input.limit + 1).lean(),
    Withdrawal.aggregate<{ _id: WithdrawalStatus; count: number; amountCents: number }>([{ $group: { _id: "$status", count: { $sum: 1 }, amountCents: { $sum: "$amountCents" } } }]),
  ]);
  const page = rows.slice(0, input.limit);
  const users = await User.find({ _id: { $in: page.map(row => row.userId) } }).select("name email referralCode").lean();
  const byId = new Map(users.map(user => [String(user._id), user]));
  return {
    withdrawals: page.map(row => {
      const user = byId.get(String(row.userId));
      return { id: String(row._id), user: { id: String(row.userId), name: user?.name ?? "Удалённый пользователь", email: user?.email ?? null, referralCode: user?.referralCode ?? null },
        amountCents: row.amountCents, status: row.status, method: row.method,
        accountLabel: row.accountLabel ?? null, cardHolder: row.cardHolder ?? null,
        requestedAt: row.requestedAt, processedAt: row.processedAt ?? null,
        reviewVersion: row.reviewVersion ?? 0, reviewNote: row.reviewNote ?? null,
        paymentReference: row.paymentReference ?? null, reviewedAt: row.reviewedAt ?? null,
        reviewHistory: (row.reviewHistory ?? []).map(event => ({ action: event.action, adminId: String(event.adminId), at: event.at, note: event.note ?? null, paymentReference: event.paymentReference ?? null })),
      };
    }),
    nextCursor: rows.length > input.limit ? String(page[page.length - 1]!._id) : null,
    summary: summary.map(row => ({ status: row._id, count: row.count, amountCents: row.amountCents })),
  };
}

export async function reviewAdminWithdrawal(input: {
  id: string; action: WithdrawalAction; expectedVersion: number; adminId: Types.ObjectId;
  note?: string; paymentReference?: string; paymentConfirmed?: boolean;
}) {
  const note = input.note?.trim() ?? "";
  const reference = input.paymentReference?.trim() ?? "";
  if (input.action === "reject" && note.length < 3) throw new ApiError(400, "rejection_reason_required", "Укажите причину отклонения.");
  if (input.action === "mark_paid" && (!input.paymentConfirmed || reference.length < 3)) throw new ApiError(400, "payment_confirmation_required", "Подтвердите уже выполненный перевод и укажите номер операции.");
  const target = input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "paid";
  const allowed = input.action === "approve" ? ["pending_review"] : input.action === "reject" ? ["pending_review", "approved"] : ["approved"];
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const row = await Withdrawal.findOneAndUpdate({
        _id: input.id, method: "bank_card", status: { $in: allowed },
        ...(input.expectedVersion === 0 ? { $or: [{ reviewVersion: 0 }, { reviewVersion: { $exists: false } }] } : { reviewVersion: input.expectedVersion }),
      }, { $set: { status: target, reviewedBy: input.adminId, reviewedAt: now, reviewNote: note,
          ...(input.action !== "approve" ? { processedAt: now } : {}),
          ...(input.action === "mark_paid" ? { paymentReference: reference } : {}),
        }, $inc: { reviewVersion: 1 },
        $push: { reviewHistory: { action: input.action, adminId: input.adminId, at: now, note, ...(reference ? { paymentReference: reference } : {}) } },
      }, { new: true, session, runValidators: true });
      if (!row) throw new ApiError(409, "withdrawal_changed", "Заявка уже обработана, изменена или недоступна для этого действия. Обновите список.");
      if (!Number.isSafeInteger(row.amountUnits) || row.amountUnits <= 0) throw new ApiError(409, "invalid_reserved_amount", "Некорректная сумма резерва. Требуется проверка.");
      // Only process requests with an actual reservation in the existing ledger.
      const reservation = await LedgerEntry.exists({ userId: row.userId, type: "withdrawal", sourceId: String(row._id), amountUnits: -row.amountUnits }).session(session);
      if (!reservation) throw new ApiError(409, "withdrawal_reservation_missing", "Не найдена запись резервирования. Требуется проверка.");
      const walletFilter = { _id: row.userId, "wallet.lockedUnits": { $gte: row.amountUnits } };
      if (input.action === "approve") {
        if (!await User.exists(walletFilter).session(session)) throw new ApiError(409, "withdrawal_reserve_mismatch", "Недостаточно средств в резерве. Требуется проверка.");
        return;
      }
      const user = await User.findOneAndUpdate(walletFilter, { $inc: {
        "wallet.lockedUnits": -row.amountUnits,
        ...(input.action === "reject" ? { "wallet.availableUnits": row.amountUnits } : {}),
      } }, { new: true, session }).select("wallet");
      if (!user) throw new ApiError(409, "withdrawal_reserve_mismatch", "Недостаточно средств в резерве. Требуется проверка.");
      await LedgerEntry.create([{ userId: row.userId, type: "withdrawal", sourceId: `${row._id}:${target}`,
        amountUnits: input.action === "reject" ? row.amountUnits : 0, balanceAfterUnits: user.wallet.availableUnits,
        description: input.action === "reject" ? "Withdrawal rejected: reserved funds returned" : "Manual withdrawal confirmed paid: reserve released",
        metadata: { action: input.action, withdrawalId: String(row._id), adminId: String(input.adminId), note, paymentReference: reference, releasedUnits: row.amountUnits },
      }], { session });
    });
  } finally { await session.endSession(); }
  return { id: input.id, status: target };
}
