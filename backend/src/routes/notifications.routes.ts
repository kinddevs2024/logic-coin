import { Router } from "express";
import { z } from "zod";
import { countUnreadInbox, listInbox, markInboxRead, markAllInboxRead } from "../services/inbox.service.js";
import { validateBody } from "../middleware/validate.js";
import { ApiError } from "../lib/api-error.js";
import { RaffleWinNotice } from "../models/RaffleWinNotice.js";
const router = Router();
router.get("/raffle-win", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const notice = await RaffleWinNotice.findOne({ userId: req.auth!.userId, acknowledgedAt: { $exists: false } }).sort({ createdAt: 1 }).lean();
  res.json({ data: notice ? { id: String(notice._id), round: notice.round, amountCents: notice.amountCents } : null });
});
router.post("/raffle-win/:id/ack", async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(String(req.params.id))) throw new ApiError(400, "invalid_notice", "Invalid notice");
  await RaffleWinNotice.updateOne({ _id: req.params.id, userId: req.auth!.userId, acknowledgedAt: { $exists: false } }, { $set: { acknowledgedAt: new Date() } });
  res.json({ data: { acknowledged: true } });
});
router.get("/unread-count", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ data: { count: await countUnreadInbox(req.auth!.userId) } });
});
const id = z.string().regex(/^(event|gift|result):[a-f\d]{24}$/i);
router.get("/", async (req, res) => {
  const query = z.object({ all: z.enum(["true", "false"]).optional(), date: z.string().datetime().optional(), id: id.optional() }).safeParse(req.query);
  if (!query.success || Boolean(query.data.date) !== Boolean(query.data.id)) throw new ApiError(400, "invalid_query", "Invalid notification cursor");
  res.json({ data: await listInbox(req.auth!.userId, query.data.all === "true", query.data.date && query.data.id ? { date: query.data.date, id: query.data.id } : undefined) });
});
router.post("/read", validateBody(z.object({ ids: z.array(id).min(1).max(30) }).strict()), async (req, res) => {
  res.json({ data: await markInboxRead(req.auth!.userId, req.body.ids) });
});
router.post("/read-all", validateBody(z.object({}).strict()), async (req, res) => {
  res.json({ data: await markAllInboxRead(req.auth!.userId) });
});
export default router;
