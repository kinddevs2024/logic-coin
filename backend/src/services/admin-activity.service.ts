import { env } from "../config/env.js";
import { dayBoundsInTimeZone } from "../lib/date.js";
import { ActivityDay } from "../models/ActivityDay.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { CoinRewardLogin } from "../models/CoinRewardLogin.js";
import { User } from "../models/User.js";

// Daily active users, not concurrent connections. Keep this read-only: the
// legacy activity journal also controls attendance rewards and streaks.
export async function countActivePlayers(firstDay: string, lastDay = firstDay): Promise<number> {
  const { from } = dayBoundsInTimeZone(firstDay, env.DEFAULT_TIMEZONE);
  const { to } = dayBoundsInTimeZone(lastDay, env.DEFAULT_TIMEZONE);
  const during = { $gte: from, $lt: to };
  const sources = await Promise.all([
    ActivityDay.distinct("userId", { dayKey: { $gte: firstDay, $lte: lastDay } }),
    CoinRewardLogin.distinct("userId", { createdAt: during }),
    ChallengeAttempt.distinct("userId", { $or: [{ startedAt: during }, { completedAt: during }] }),
    User.distinct("_id", { lastLoginAt: during }),
  ]);
  return new Set(sources.flat().map(id => String(id))).size;
}
