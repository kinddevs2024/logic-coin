import { env } from "../config/env.js";
import { addDays, currentMonthBounds, currentWeekBounds, dayBoundsInTimeZone, daysBetween, localDayKey } from "../lib/date.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { DailyContestResult } from "../models/DailyContestResult.js";
import { User } from "../models/User.js";

// Read-only presentation of activity. Does not select winners or award money.
export function activityPeriod(kind: "week" | "month", today: string, completed: readonly string[]) {
  const bounds = kind === "week" ? currentWeekBounds(today) : currentMonthBounds(today);
  const days = new Set(completed.filter(day => day >= bounds.from && day <= today && day <= bounds.to));
  const totalDays = daysBetween(bounds.from, bounds.to) + 1;
  const missedDays = daysBetween(bounds.from, today) - [...days].filter(day => day < today).length;
  const allowedMisses = kind === "week" ? 2 : 4;
  return { from: bounds.from, endsAt: dayBoundsInTimeZone(addDays(bounds.to, 1), env.DEFAULT_TIMEZONE).from.toISOString(), totalDays, completedDays: days.size, missedDays, allowedMisses, eligible: missedDays <= allowedMisses, percent: Math.round(days.size / totalDays * 100) };
}

type DaysRow = { _id: string; days: string[] };
let cached: { day: string; expires: number; value: Promise<Map<string, string[]>> } | undefined;
function completedDays(today: string) {
  if (cached?.day === today && cached.expires > Date.now()) return cached.value;
  const from = [currentWeekBounds(today).from, currentMonthBounds(today).from].sort()[0]!;
  const range = { $gte: from, $lte: today };
  const value = Promise.all([
    ChallengeAttempt.aggregate<DaysRow>([
      { $match: { dayKey: range, mode: "challenge", status: "completed" } },
      { $group: { _id: { user: "$userId", day: "$dayKey" }, games: { $addToSet: "$gameId" } } },
      { $lookup: { from: DailyChallengeSet.collection.name, localField: "_id.day", foreignField: "dayKey", as: "sets" } },
      { $unwind: "$sets" },
      { $match: { $expr: { $and: [{ $eq: [{ $size: { $setUnion: ["$sets.gameIds", []] } }, 6] }, { $setIsSubset: ["$sets.gameIds", "$games"] }] } } },
      { $group: { _id: "$_id.user", days: { $addToSet: "$_id.day" } } },
    ]),
    DailyContestResult.aggregate<DaysRow>([
      { $match: { dayKey: range, completedGamesCount: 6 } },
      { $group: { _id: "$userId", days: { $addToSet: "$dayKey" } } },
    ]),
  ]).then(groups => {
    const result = new Map<string, string[]>();
    for (const row of groups.flat()) {
      const id = String(row._id);
      result.set(id, [...new Set([...(result.get(id) ?? []), ...row.days])]);
    }
    return result;
  });
  cached = { day: today, expires: Date.now() + 60_000, value };
  void value.catch(() => { if (cached?.value === value) cached = undefined; });
  return value;
}

type Player = { id: string; name: string; avatarUrl: string | null; coins: number; balanceUnits: number };
let reelCache: { days: Map<string, string[]>; value: Promise<Record<"week" | "month", Player[]>> } | undefined;
function participantReels(today: string, completed: Map<string, string[]>) {
  if (reelCache?.days === completed) return reelCache.value;
  const value = Promise.all((["week", "month"] as const).map(async kind => {
    const bounds = kind === "week" ? currentWeekBounds(today) : currentMonthBounds(today);
    const minimumClosedDays = Math.max(0, daysBetween(bounds.from, today) - (kind === "week" ? 2 : 4));
    const eligibleIds = minimumClosedDays === 0 ? null : [...completed]
      .filter(([, days]) => days.filter(day => day >= bounds.from && day < today).length >= minimumClosedDays)
      .map(([id]) => id);
    // Bounded public profile sample. Query once per shared snapshot, not once per viewer.
    const players = await User.find(eligibleIds ? { _id: { $in: eligibleIds } } : {})
      .select("name avatarUrl coins.balance wallet.availableUnits")
      .sort({ _id: 1 }).limit(24).lean();
    return [kind, players.map(player => ({ id: String(player._id), name: player.name, avatarUrl: player.avatarUrl ?? null, coins: player.coins?.balance ?? 0, balanceUnits: player.wallet?.availableUnits ?? 0 }))] as const;
  })).then(rows => Object.fromEntries(rows) as Record<"week" | "month", Player[]>);
  reelCache = { days: completed, value };
  void value.catch(() => { if (reelCache?.value === value) reelCache = undefined; });
  return value;
}

export async function homeActivity(userId: string) {
  const now = new Date();
  const today = localDayKey(now, env.DEFAULT_TIMEZONE);
  const completed = await completedDays(today);
  const players = await participantReels(today, completed);
  const periods = Object.fromEntries((["week", "month"] as const).map(kind => [kind, {
    ...activityPeriod(kind, today, completed.get(userId) ?? []), participants: players[kind],
  }]));
  return { serverNow: now.toISOString(), dayKey: today, ...periods };
}
