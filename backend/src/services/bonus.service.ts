import mongoose, { Types } from "mongoose";
import {
  DAILY_BONUS_REWARDS_UNITS,
  MONTHLY_BONUS_REWARD_UNITS,
  MONTHLY_REQUIRED_ACTIVE_DAYS,
  WEEKLY_BONUS_REWARD_UNITS,
  WEEKLY_REQUIRED_ACTIVE_DAYS
} from "../config/constants.js";
import { ApiError } from "../lib/api-error.js";
import {
  addDays,
  calculateGraceStreak,
  currentMonthBounds,
  currentWeekBounds,
  isoWeekKey,
  localDayKey,
  monthKey
} from "../lib/date.js";
import { ActivityDay } from "../models/ActivityDay.js";
import { BonusClaim } from "../models/BonusClaim.js";
import { User } from "../models/User.js";
import { serializeWallet } from "./serialization.service.js";
import { creditReward } from "./wallet.service.js";

export type BonusKind = "daily" | "weekly" | "monthly";

function bonusKey(kind: BonusKind, dayKey: string): string {
  if (kind === "daily") return `daily:${dayKey}`;
  if (kind === "weekly") return `weekly:${isoWeekKey(dayKey)}`;
  return `monthly:${monthKey(dayKey)}`;
}

export async function getBonusOverview(userId: Types.ObjectId) {
  const user = await User.findById(userId).select("preferences.timezone");
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  const today = localDayKey(new Date(), user.preferences.timezone);
  const week = currentWeekBounds(today);
  const month = currentMonthBounds(today);

  const [recentDays, weekActiveDays, monthActiveDays, claims] = await Promise.all([
    ActivityDay.find({ userId, dayKey: { $gte: addDays(today, -400), $lte: today } })
      .select("dayKey")
      .lean(),
    ActivityDay.countDocuments({ userId, dayKey: { $gte: week.from, $lte: week.to } }),
    ActivityDay.countDocuments({ userId, dayKey: { $gte: month.from, $lte: month.to } }),
    BonusClaim.find({
      userId,
      key: { $in: (["daily", "weekly", "monthly"] as BonusKind[]).map((kind) => bonusKey(kind, today)) }
    }).lean()
  ]);
  const claimedKeys = new Set(claims.map((claim) => claim.key));
  const activeKeys = recentDays.map((day) => day.dayKey);
  const prospective = activeKeys.includes(today) ? activeKeys : [...activeKeys, today];
  const prospectiveStreak = calculateGraceStreak(prospective, today);
  const dailyReward =
    DAILY_BONUS_REWARDS_UNITS[
      Math.max(0, prospectiveStreak.activeDays - 1) % DAILY_BONUS_REWARDS_UNITS.length
    ]!;

  return {
    timezone: user.preferences.timezone,
    today,
    streak: calculateGraceStreak(activeKeys, today),
    daily: {
      key: bonusKey("daily", today),
      rewardUnits: dailyReward,
      claimed: claimedKeys.has(bonusKey("daily", today)),
      available: !claimedKeys.has(bonusKey("daily", today))
    },
    weekly: {
      key: bonusKey("weekly", today),
      rewardUnits: WEEKLY_BONUS_REWARD_UNITS,
      activeDays: weekActiveDays,
      requiredActiveDays: WEEKLY_REQUIRED_ACTIVE_DAYS,
      claimed: claimedKeys.has(bonusKey("weekly", today)),
      available:
        weekActiveDays >= WEEKLY_REQUIRED_ACTIVE_DAYS &&
        !claimedKeys.has(bonusKey("weekly", today)),
      period: week
    },
    monthly: {
      key: bonusKey("monthly", today),
      rewardUnits: MONTHLY_BONUS_REWARD_UNITS,
      activeDays: monthActiveDays,
      requiredActiveDays: MONTHLY_REQUIRED_ACTIVE_DAYS,
      claimed: claimedKeys.has(bonusKey("monthly", today)),
      available:
        monthActiveDays >= MONTHLY_REQUIRED_ACTIVE_DAYS &&
        !claimedKeys.has(bonusKey("monthly", today)),
      period: month
    }
  };
}

export async function claimBonus(userId: Types.ObjectId, kind: BonusKind) {
  const userSnapshot = await User.findById(userId).select("preferences.timezone");
  if (!userSnapshot) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  const snapshotDayKey = localDayKey(new Date(), userSnapshot.preferences.timezone);
  const key = bonusKey(kind, snapshotDayKey);
  const existing = await BonusClaim.findOne({ userId, key });
  if (existing) {
    const user = await User.findById(userId).select("wallet");
    return { claim: existing, wallet: serializeWallet(user?.wallet), idempotentReplay: true };
  }

  const session = await mongoose.startSession();
  let claimId: Types.ObjectId | null = null;
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(userId).select("preferences.timezone").session(session);
      if (!user) {
        throw new ApiError(404, "user_not_found", "User not found");
      }
      const dayKey = localDayKey(new Date(), user.preferences.timezone);
      const currentKey = bonusKey(kind, dayKey);
      const duplicate = await BonusClaim.findOne({ userId, key: currentKey }).session(session);
      if (duplicate) {
        claimId = duplicate._id;
        return;
      }

      let rewardUnits: number;
      if (kind === "daily") {
        const days = await ActivityDay.find({
          userId,
          dayKey: { $gte: addDays(dayKey, -400), $lte: dayKey }
        })
          .select("dayKey")
          .session(session)
          .lean();
        const activeKeys = days.map((day) => day.dayKey);
        if (!activeKeys.includes(dayKey)) activeKeys.push(dayKey);
        const streak = calculateGraceStreak(activeKeys, dayKey);
        rewardUnits =
          DAILY_BONUS_REWARDS_UNITS[
            Math.max(0, streak.activeDays - 1) % DAILY_BONUS_REWARDS_UNITS.length
          ]!;
      } else {
        const bounds = kind === "weekly" ? currentWeekBounds(dayKey) : currentMonthBounds(dayKey);
        const activeDays = await ActivityDay.countDocuments({
          userId,
          dayKey: { $gte: bounds.from, $lte: bounds.to }
        }).session(session);
        const required =
          kind === "weekly" ? WEEKLY_REQUIRED_ACTIVE_DAYS : MONTHLY_REQUIRED_ACTIVE_DAYS;
        if (activeDays < required) {
          throw new ApiError(409, "bonus_not_ready", "Bonus activity requirement is not met", {
            activeDays,
            requiredActiveDays: required
          });
        }
        rewardUnits =
          kind === "weekly" ? WEEKLY_BONUS_REWARD_UNITS : MONTHLY_BONUS_REWARD_UNITS;
      }

      const [claim] = await BonusClaim.create(
        [
          {
            userId,
            key: currentKey,
            kind,
            rewardUnits,
            localDayKey: dayKey,
            claimedAt: new Date()
          }
        ],
        { session }
      );
      if (!claim) {
        throw new ApiError(500, "bonus_claim_failed", "Bonus claim could not be created");
      }
      claimId = claim._id;
      await creditReward(
        {
          userId,
          amountUnits: rewardUnits,
          type: `${kind}_bonus`,
          sourceId: claim._id.toString(),
          description: `${kind[0]!.toUpperCase()}${kind.slice(1)} activity bonus`,
          ...(kind === "daily" ? { dayKey } : {})
        },
        session
      );
    });
  } catch (error) {
    const mongoError = error as { code?: number };
    if (mongoError.code === 11_000) {
      const replay = await BonusClaim.findOne({ userId, key });
      if (replay) {
        const user = await User.findById(userId).select("wallet");
        return { claim: replay, wallet: serializeWallet(user?.wallet), idempotentReplay: true };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }

  const [claim, user] = await Promise.all([
    BonusClaim.findById(claimId),
    User.findById(userId).select("wallet")
  ]);
  if (!claim || !user) {
    throw new ApiError(500, "bonus_result_unavailable", "Bonus result is unavailable");
  }
  return { claim, wallet: serializeWallet(user.wallet), idempotentReplay: false };
}
