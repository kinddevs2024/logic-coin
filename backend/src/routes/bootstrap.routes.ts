import { Router } from "express";
import { env } from "../config/env.js";
import { addDays, calculateGraceStreak, localDayKey } from "../lib/date.js";
import { ApiError } from "../lib/api-error.js";
import { ActivityDay } from "../models/ActivityDay.js";
import { User } from "../models/User.js";
import { getBonusOverview } from "../services/bonus.service.js";
import { getReferralOverview } from "../services/referral.service.js";
import { serializeUser } from "../services/serialization.service.js";
import { listTasksForUser } from "../services/task.service.js";

const router = Router();

router.get("/", async (request, response) => {
  const user = await User.findById(request.auth!.userId);
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  const today = localDayKey(new Date(), user.preferences.timezone);
  const [tasks, bonuses, referral, recentDays, totalActiveDays] = await Promise.all([
    listTasksForUser(user._id),
    getBonusOverview(user._id),
    getReferralOverview(user._id),
    ActivityDay.find({
      userId: user._id,
      dayKey: { $gte: addDays(today, -400), $lte: today }
    })
      .select("dayKey")
      .lean(),
    ActivityDay.countDocuments({ userId: user._id })
  ]);

  response.json({
    data: {
      user: serializeUser(user),
      tasks,
      bonuses,
      activity: {
        totalActiveDays,
        streak: calculateGraceStreak(
          recentDays.map((day) => day.dayKey),
          today
        )
      },
      referral,
      economy: {
        currency: "USD",
        unitValueCents: env.UNIT_VALUE_CENTS,
        minimumWithdrawalCents: env.MIN_WITHDRAWAL_CENTS,
        withdrawalsAreSandbox: true,
        taskProvider: "demo"
      },
      supported: {
        languages: ["en", "ru", "uz"]
      }
    }
  });
});

export default router;
