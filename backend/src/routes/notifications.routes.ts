import { Router } from "express";
import { z } from "zod";
import { listInbox, markInboxRead } from "../services/inbox.service.js";
import { validateBody } from "../middleware/validate.js";
import { ApiError } from "../lib/api-error.js";
const router = Router();
const id = z.string().regex(/^(event|gift|result):[a-f\d]{24}$/i);
router.get("/", async (req, res) => {
  const query = z.object({ all: z.enum(["true", "false"]).optional(), date: z.string().datetime().optional(), id: id.optional() }).safeParse(req.query);
  if (!query.success || Boolean(query.data.date) !== Boolean(query.data.id)) throw new ApiError(400, "invalid_query", "Invalid notification cursor");
  res.json({ data: await listInbox(req.auth!.userId, query.data.all === "true", query.data.date && query.data.id ? { date: query.data.date, id: query.data.id } : undefined) });
});
router.post("/read", validateBody(z.object({ ids: z.array(id).min(1).max(30) }).strict()), async (req, res) => {
  res.json({ data: await markInboxRead(req.auth!.userId, req.body.ids) });
});
export default router;
