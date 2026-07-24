import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../lib/api-error.js";
import {
  addDays,
  calculateGraceStreak,
  daysBetween,
  localDayKey,
  parseDayKey
} from "../lib/date.js";
import { rewardLimiter } from "../middleware/rate-limits.js";
import { ActivityDay } from "../models/ActivityDay.js";
import { User } from "../models/User.js";

const router = Router();
const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  try {
    parseDayKey(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid calendar date");

router.get("/", async (request, response) => {
  const user = await User.findById(request.auth!.userId).select("preferences.timezone");
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  const today = localDayKey(new Date(), user.preferences.timezone);
  const query = z
    .object({
      from: dayKeySchema.default(addDays(today, -90)),
      to: dayKeySchema.default(today)
    })
    .safeParse(request.query);
  if (
    !query.success ||
    query.data.from > query.data.to ||
    daysBetween(query.data.from, query.data.to) > 366
  ) {
    throw new ApiError(400, "validation_error", "Activity range must cover at most 367 days");
  }

  const [days, streakDays, totalActiveDays] = await Promise.all([
    ActivityDay.find({
      userId: request.auth!.userId,
      dayKey: { $gte: query.data.from, $lte: query.data.to }
    })
      .sort({ dayKey: 1 })
      .lean(),
    ActivityDay.find({
      userId: request.auth!.userId,
      dayKey: { $gte: addDays(today, -400), $lte: today }
    })
      .select("dayKey")
      .sort({ dayKey: 1 })
      .lean(),
    ActivityDay.countDocuments({ userId: request.auth!.userId })
  ]);

  response.json({
    data: {
      from: query.data.from,
      to: query.data.to,
      timezone: user.preferences.timezone,
      totalActiveDays,
      streak: calculateGraceStreak(
        streakDays.map((day) => day.dayKey),
        today
      ),
      days: days.map((day) => ({
        dayKey: day.dayKey,
        actionCount: day.actionCount,
        rewardUnits: day.rewardUnits
      }))
    }
  });
});

router.post("/check-in", rewardLimiter, async (request, response) => {
  const user = await User.findById(request.auth!.userId).select("preferences.timezone");
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  const now = new Date();
  const dayKey = localDayKey(now, user.preferences.timezone);
  const day = await ActivityDay.findOneAndUpdate(
    { userId: request.auth!.userId, dayKey },
    {
      $inc: { actionCount: 1 },
      $set: { lastActivityAt: now },
      $setOnInsert: { firstActivityAt: now, rewardUnits: 0 }
    },
    { upsert: true, new: true }
  );
  response.json({
    data: {
      day: {
        dayKey: day.dayKey,
        actionCount: day.actionCount,
        rewardUnits: day.rewardUnits
      }
    }
  });
});

export default router;
