import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireReports } from "../middleware/admin.js";
import { ApiError } from "../lib/api-error.js";
import { parseDayKey, addDays, daysBetween } from "../lib/date.js";
import { challengeDayKey } from "../services/daily-challenge.service.js";
import { getAdminOverview, getAdminAnalytics, getBudgetAnalytics, listAdminDailyChallenges } from "../services/admin.service.js";
import { Withdrawal } from "../models/Withdrawal.js";
const router = Router();
router.use(requireAuth, requireReports);
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
function day(value: unknown) {
  const parsed = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(value);
  if (!parsed.success) throw new ApiError(400, "invalid_day_key", "Invalid date");
  try { parseDayKey(parsed.data); } catch { throw new ApiError(400, "invalid_day_key", "Invalid date"); }
  return parsed.data;
}
router.get("/overview", async (req, res) => res.json({data: await getAdminOverview(day(req.query.dayKey ?? challengeDayKey()), true)}));
router.get("/analytics", async (req, res) => res.json({data: await getAdminAnalytics(day(req.query.dayKey ?? challengeDayKey()), true)}));
router.get("/budget", async (req, res) => {
  const days = z.coerce.number().int().min(1).max(366).safeParse(req.query.days ?? 30);
  if (!days.success) throw new ApiError(400, "invalid_days", "Invalid range");
  res.json({data: await getBudgetAnalytics(days.data)});
});
router.get("/daily-challenges", async (req, res) => {
  const to = day(req.query.to ?? challengeDayKey()), from = day(req.query.from ?? addDays(to, -29));
  if (from > to || daysBetween(from, to) > 365) throw new ApiError(400, "invalid_range", "Invalid range");
  res.json({data: {challenges: await listAdminDailyChallenges(from, to, true)}});
});
router.get("/withdrawals", async (_req, res) => {
  const totals = await Withdrawal.aggregate([{$group: {_id: "$status", count: {$sum: 1}, amountUnits: {$sum: "$amountUnits"}}}]);
  res.json({data: {totals}});
});
export default router;
