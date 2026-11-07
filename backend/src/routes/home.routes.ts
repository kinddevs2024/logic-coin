import { Router } from "express";
import { HomeContent } from "../models/HomeContent.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { DailyContestSettlement } from "../models/DailyContestSettlement.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { currentMonthBounds, currentWeekBounds, daysBetween } from "../lib/date.js";
import { challengeDayKey } from "../services/daily-challenge.service.js";

const router = Router();
router.get("/", async (req, res) => {
  const dayKey = challengeDayKey();
  const week = currentWeekBounds(dayKey);
  const month = currentMonthBounds(dayKey);
  const [content, sets, completions, current] = await Promise.all([
    HomeContent.findOne({ key: "home" }).lean(),
    DailyChallengeSet.find({ dayKey: { $gte: month.from < week.from ? month.from : week.from, $lte: dayKey }, status: { $in: ["published", "settled"] } }).select("dayKey gameIds").lean(),
    ChallengeAttempt.find({ userId: req.auth!.userId, mode: "challenge", status: "completed", dayKey: { $gte: month.from < week.from ? month.from : week.from, $lte: dayKey } }).select("dailyChallengeSetId gameId").lean(),
    DailyChallengeSet.findOne({ dayKey: { $lte: dayKey }, status: { $in: ["published", "settled"] } }).sort({ dayKey: -1 }).lean(),
  ]);
  // A closed day means the entire published set was completed, not merely entered.
  const done = new Map<string, Set<string>>();
  for (const attempt of completions) {
    const key = String(attempt.dailyChallengeSetId);
    if (!done.has(key)) done.set(key, new Set());
    done.get(key)!.add(String(attempt.gameId));
  }
  const closed = sets.filter(set => set.gameIds.length > 0 && set.gameIds.every(id => done.get(String(set._id))?.has(String(id))));
  const period = (bounds: { from: string; to: string }) => ({
    ...bounds, completed: closed.filter(set => set.dayKey >= bounds.from && set.dayKey <= bounds.to).length,
    total: daysBetween(bounds.from, bounds.to) + 1,
  });
  const settlement = current ? await DailyContestSettlement.findOne({ dayKey: current.dayKey }).select("status").lean() : null;
  res.setHeader("Cache-Control", "no-store");
  res.json({ data: {
    serverNow: new Date().toISOString(),
    content: { rules: content?.rules ?? "", weeklyDetails: content?.weeklyDetails ?? "", monthlyDetails: content?.monthlyDetails ?? "", instagramUrl: content?.instagramUrl ?? "", telegramUrl: content?.telegramUrl ?? "" },
    weekly: period(week), monthly: period(month),
    championship: current ? { dayKey: current.dayKey, endsAt: current.endsAt?.toISOString() ?? null, resultsPublished: settlement?.status === "settled" } : null,
  } });
});
export default router;
