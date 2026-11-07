import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { rewardLimiter } from "../middleware/rate-limits.js";
import { claimHomeGiftAds, claimHomeGiftTelegram, finishHomeGiftTelegramLink, getHomeGiftOffer, startHomeGiftAds, startHomeGiftTelegramLink } from "../services/home-gift.service.js";
import { claimHomeGiftInstagram, skipHomeGiftTelegram, startHomeGiftInstagram } from "../services/home-gift.service.js";
const router = Router();
router.get("/", async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json({ data: await getHomeGiftOffer(req.auth!.userId, req.query.includeInstagram === "true") }); });
router.post("/telegram/skip", rewardLimiter, async (req, res) => { res.json({ data: await skipHomeGiftTelegram(req.auth!.userId) }); });
router.post("/instagram/start", rewardLimiter, async (req, res) => { res.json({ data: await startHomeGiftInstagram(req.auth!.userId) }); });
router.post("/instagram/claim", rewardLimiter, validateBody(z.object({ visitId: z.string().uuid() }).strict()), async (req, res) => { res.json({ data: await claimHomeGiftInstagram(req.auth!.userId, req.body.visitId) }); });
router.post("/telegram/link", rewardLimiter, async (req, res) => { res.json({ data: await startHomeGiftTelegramLink(req.auth!.userId) }); });
router.post("/telegram/finish-link", rewardLimiter, validateBody(z.object({ flowId: z.string().min(20).max(64), pollToken: z.string().min(20).max(128) }).strict()), async (req, res) => {
  res.json({ data: await finishHomeGiftTelegramLink(req.auth!.userId, req.body.flowId, req.body.pollToken) });
});
router.post("/telegram/claim", rewardLimiter, async (req, res) => { res.json({ data: await claimHomeGiftTelegram(req.auth!.userId) }); });
router.post("/ads/start", rewardLimiter, async (req, res) => { res.json({ data: await startHomeGiftAds(req.auth!.userId) }); });
router.post("/ads/claim", rewardLimiter, validateBody(z.object({ cycleId: z.string().uuid() }).strict()), async (req, res) => { res.json({ data: await claimHomeGiftAds(req.auth!.userId, req.body.cycleId) }); });
export default router;
