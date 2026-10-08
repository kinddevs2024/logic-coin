import { Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { computeContestBands, rankContestStandings } from "../lib/contest.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { DailyContestResult } from "../models/DailyContestResult.js";
import { DailyContestSettlement } from "../models/DailyContestSettlement.js";
import { User } from "../models/User.js";
import { collectContestStandings } from "./contest.service.js";
import { challengeDayKey } from "./daily-challenge.service.js";

export function validHistoryDay(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(`${day}T00:00:00Z`)) &&
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
}

export async function getContestHistory(day: string | undefined, offset: number, userId: Types.ObjectId) {
  const today = challengeDayKey();
  const dayKey = day ?? today;
  if (!validHistoryDay(dayKey) || dayKey > today) throw new ApiError(400, "invalid_day_key", "Choose a valid day, not in the future");
  const [sets, settlement, set] = await Promise.all([
    DailyChallengeSet.find({ status: "published", dayKey: { $lte: today } }).sort({ dayKey: -1 }).limit(31).select("dayKey").lean(),
    DailyContestSettlement.findOne({ dayKey, status: "settled" }).lean(),
    DailyChallengeSet.findOne({ dayKey, status: "published" }).select("endsAt").lean(),
  ]);
  const status = settlement ? "final" : dayKey === today && set && (!set.endsAt || set.endsAt.getTime() > Date.now()) ? "live" : set ? "pending" : "missing";
  const nearbyDays = [-3, -2, -1, 0, 1, 2, 3].map(offset => {
    const date = new Date(`${dayKey}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }).filter(value => value <= today);
  const [nearbySets, nearbySettled] = await Promise.all([
    DailyChallengeSet.find({ dayKey: { $in: nearbyDays }, status: "published" }).select("dayKey endsAt").lean(),
    DailyContestSettlement.find({ dayKey: { $in: nearbyDays }, status: "settled" }).select("dayKey").lean(),
  ]);
  const dayStatuses: Record<string, "final" | "live" | "pending" | "missing"> = {};
  for (const value of nearbyDays) {
    const published = nearbySets.find(row => row.dayKey === value);
    dayStatuses[value] = nearbySettled.some(row => row.dayKey === value) ? "final" : value === today && published && (!published.endsAt || published.endsAt.getTime() > Date.now()) ? "live" : published ? "pending" : "missing";
  }
  let entries: { userId: string; rank: number; totalCoins: number; completedGamesCount: number }[] = [];
  let total = 0;
  let self: { userId: string; rank: number; totalCoins: number; completedGamesCount: number } | null = null;
  if (status === "final") {
    const [count, results] = await Promise.all([
      DailyContestResult.countDocuments({ dayKey }),
      DailyContestResult.find({ dayKey }).sort({ rank: 1 }).skip(offset).limit(15).select("userId rank totalCoins completedGamesCount").lean(),
    ]);
    total = count;
    entries = results.map(row => ({ userId: row.userId.toString(), rank: row.rank, totalCoins: row.totalCoins, completedGamesCount: row.completedGamesCount }));
    const own = await DailyContestResult.findOne({ dayKey, userId }).select("rank totalCoins completedGamesCount").lean();
    if (own) self = { userId: userId.toString(), rank: own.rank, totalCoins: own.totalCoins, completedGamesCount: own.completedGamesCount };
  } else if (status === "live") {
    const standings = await collectContestStandings(dayKey);
    const ranked = rankContestStandings(standings, computeContestBands(standings.length));
    total = ranked.length;
    entries = ranked.slice(offset, offset + 15);
    const own = ranked.find(row => row.userId === userId.toString());
    if (own) self = { userId: own.userId, rank: own.rank, totalCoins: own.totalCoins, completedGamesCount: own.completedGamesCount };
  }
  const users = await User.find({ _id: { $in: entries.map(row => new Types.ObjectId(row.userId)) } }).select("name avatarUrl").lean();
  const byId = new Map(users.map(user => [user._id.toString(), user]));
  return { today, dayKey, days: sets.map(row => row.dayKey), dayStatuses, status, self, total, nextOffset: offset + entries.length < total ? offset + entries.length : null,
    rows: entries.map(row => ({ ...row, name: byId.get(row.userId)?.name ?? "Player", avatarUrl: byId.get(row.userId)?.avatarUrl ?? null, isSelf: row.userId === userId.toString() })) };
}
