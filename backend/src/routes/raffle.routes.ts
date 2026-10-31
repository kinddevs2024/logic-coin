import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/admin.js";
import { validateBody } from "../middleware/validate.js";
import { youtubeVideoId } from "../lib/raffle-policy.js";
import { raffleHeartbeat, raffleState, saveRaffle, publishRaffle, spinRaffle, finishRaffle, listRaffles } from "../services/raffle.service.js";
const router = Router();
router.get("/state", async (req,res) => { res.set("Cache-Control", "no-store"); res.json({ data: await raffleState(req.auth!.userId) }); });
router.post("/presence", validateBody(z.object({ online: z.boolean() }).strict()), async (req,res) => { res.json({ data: await raffleHeartbeat(req.auth!.userId, req.body.online, req.auth!.sessionId) }); });
router.use(requireAdmin);
router.get("/admin", async (req,res) => res.json({ data: { ...await raffleState(req.auth!.userId, true), history: await listRaffles() } }));
const prize = z.object({ label: z.string().trim().min(1).max(160), kind: z.enum(["cash", "physical"]), cashUnits: z.number().int().min(0).max(100000000), durationSeconds: z.number().int().min(5).max(180) }).strict().superRefine((value,ctx) => {
 if (value.kind === "cash" && value.cashUnits <= 0 || value.kind === "physical" && value.cashUnits !== 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Укажите денежную сумму только для денежного приза" });
});
router.post("/admin", validateBody(z.object({ title: z.string().trim().min(1).max(100), startsAt: z.string().datetime({ offset: true }), lockMinutes: z.number().int().min(1).max(30), youtubeUrl: z.string().max(500).refine(value => Boolean(youtubeVideoId(value)), "Нужна ссылка на YouTube-эфир"), allowRepeatWinners: z.boolean(), rounds: z.array(prize).min(1).max(50) }).strict()), async (req,res) => {
 const { youtubeUrl, ...input } = req.body;
 const event = await saveRaffle({ ...input, youtubeId: youtubeVideoId(youtubeUrl)! }, req.auth!.userId);
 res.status(201).json({ data: { id: String(event._id) } });
});
router.post("/admin/:id/publish", async (req,res) => { await publishRaffle(String(req.params.id)); res.json({ data: { ok: true } }); });
router.post("/admin/:id/spin", validateBody(z.object({ roundId: z.string().regex(/^[a-f\d]{24}$/i) }).strict()), async (req,res) => { await spinRaffle(String(req.params.id), req.body.roundId); res.json({ data: { ok: true } }); });
router.post("/admin/:id/end", validateBody(z.object({ cancel: z.boolean() }).strict()), async (req,res) => { await finishRaffle(String(req.params.id), req.body.cancel); res.json({ data: { ok: true } }); });
export default router;
