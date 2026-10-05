import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../lib/api-error.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { validateBody } from "../middleware/validate.js";
import { listAdminWithdrawals, reviewAdminWithdrawal, withdrawalStatuses } from "../services/admin-withdrawal.service.js";
const router = Router();
router.use(requireAuth, requireAdmin);
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.get("/", async (req, res) => {
  const parsed = z.object({ status: z.enum(withdrawalStatuses).optional(), before: z.string().regex(/^[a-f0-9]{24}$/i).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }).strict().safeParse(req.query);
  if (!parsed.success) throw new ApiError(400, "invalid_withdrawal_query", "Некорректные фильтры заявок.");
  res.json({ data: await listAdminWithdrawals({ limit: parsed.data.limit, ...(parsed.data.status ? { status: parsed.data.status } : {}), ...(parsed.data.before ? { before: parsed.data.before } : {}) }) });
});
router.post("/:id/review", validateBody(z.object({
  action: z.enum(["approve", "reject", "mark_paid"]), expectedVersion: z.number().int().min(0),
  note: z.string().trim().max(400).optional(), paymentReference: z.string().trim().max(160).optional(), paymentConfirmed: z.boolean().optional(),
}).strict()), async (req, res) => {
  const id = z.string().regex(/^[a-f0-9]{24}$/i).safeParse(req.params.id);
  if (!id.success) throw new ApiError(400, "invalid_withdrawal_id", "Некорректный номер заявки.");
  res.json({ data: await reviewAdminWithdrawal({ ...req.body, id: id.data, adminId: req.auth!.userId }) });
});
export default router;
