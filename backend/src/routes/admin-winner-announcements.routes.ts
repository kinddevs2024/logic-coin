import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { validateBody } from "../middleware/validate.js";
import { winnerAnnouncementSchema } from "../lib/winner-announcement.js";
import { findWinnerRecipients, listWinnerAnnouncements, publishWinnerAnnouncement } from "../services/winner-announcements.service.js";
import { ApiError } from "../lib/api-error.js";
const router = Router();
router.use(requireAuth, requireAdmin);
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.get("/recipients", async (req, res) => {
  const q = z.string().trim().max(100).safeParse(req.query.q ?? "");
  if (!q.success) throw new ApiError(400, "invalid_query", "Некорректный поисковый запрос.");
  res.json({ data: await findWinnerRecipients(q.data) });
});
router.get("/", async (_req, res) => { res.json({ data: await listWinnerAnnouncements() }); });
router.post("/", validateBody(winnerAnnouncementSchema), async (req, res) => {
  res.json({ data: await publishWinnerAnnouncement(req.body, req.auth!.userId) });
});
export default router;
