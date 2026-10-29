import { Types } from "mongoose";
import { env } from "../config/env.js";
import { addDays, dayBoundsInTimeZone, localDayKey } from "../lib/date.js";
import { listAvatarUrl } from "../lib/list-avatar.js";
import { contestPrizePlan } from "../lib/manual-contest-prizes.js";
import { cachedRead } from "../lib/read-cache.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { DailyContestResult } from "../models/DailyContestResult.js";
import { User } from "../models/User.js";
import { collectContestStandings } from "./contest.service.js";

export const rankingPeriods = ["today", "yesterday", "allTime"] as const;
type RankingPeriod = typeof rankingPeriods[number];
type RankedScore = { _id: Types.ObjectId; walletBalanceUnits: number; coinBalance: number; rank: number };

export function rankingBounds(period: "today" | "yesterday", now: Date) {
  return dayBoundsInTimeZone(addDays(localDayKey(now, env.DEFAULT_TIMEZONE), period === "yesterday" ? -1 : 0), env.DEFAULT_TIMEZONE);
}

async function periodRows(period: RankingPeriod, dayKey: string): Promise<RankedScore[]> {
  if (period === "allTime") {
    // Preserve the existing cumulative earnings leaderboard.
    const scores = await User.aggregate<Omit<RankedScore, "rank">>([
      { $project: {
        walletBalanceUnits: { $ifNull: ["$wallet.lifetimeEarnedUnits", 0] },
        coinBalance: { $ifNull: ["$coins.lifetimeEarned", 0] },
      } },
      { $sort: { walletBalanceUnits: -1, coinBalance: -1, _id: 1 } },
    ]);
    return scores.map((row, index) => ({ ...row, rank: index + 1 }));
  }

  if (period === "yesterday") {
    // Settlement is the authoritative frozen result, including unclaimed cash.
    // A later claim must not move a prize into a different day's ranking.
    const results = await DailyContestResult.find({ dayKey })
      .select("userId rank totalCoins cashUnits").sort({ rank: 1 }).lean();
    if (results.length) return results.map(row => ({
      _id: row.userId, rank: row.rank, coinBalance: row.totalCoins,
      walletBalanceUnits: row.cashUnits ?? 0,
    }));
  }

  const [set, standings] = await Promise.all([
    DailyChallengeSet.findOne({ dayKey, status: "published" }).lean(),
    collectContestStandings(dayKey),
  ]);
  if (!set) return [];
  // Reuse the actual challenge standings, tie breaks and prize allocation.
  // Practice, ordinary ad/attendance coins and wallet credits are not scores.
  // Before yesterday's settlement completes this is also the provisional result.
  return contestPrizePlan(standings, set).ranked.map(row => ({
    _id: new Types.ObjectId(row.userId), rank: row.rank,
    coinBalance: row.totalCoins, walletBalanceUnits: row.cashUnits,
  }));
}

export async function getPeriodLeaderboards(input: { userId: Types.ObjectId; offset: number; limit: number }, now = new Date()) {
  const today = localDayKey(now, env.DEFAULT_TIMEZONE);
  // One shared snapshot per period, rather than calculating prizes per viewer.
  const snapshots = await Promise.all(rankingPeriods.map(period => cachedRead(
    `period-ranking-v4:${today}:${period}`, 5_000, async () => {
      const rows = await periodRows(period, period === "yesterday" ? addDays(today, -1) : today);
      return { rows, byId: new Map(rows.map(row => [String(row._id), row])) };
    },
  )));
  const ids = new Set([String(input.userId)]);
  snapshots.forEach(snapshot => snapshot.rows.slice(input.offset, input.offset + input.limit).forEach(row => ids.add(String(row._id))));
  const users = await User.find({ _id: { $in: [...ids] } }).select("name avatarUrl countryCode").lean();
  const people = new Map(users.map(user => [String(user._id), user]));
  const entry = (row: RankedScore) => {
    const person = people.get(String(row._id));
    return { rank: row.rank, userId: String(row._id), name: person?.name ?? "Player",
      avatarUrl: listAvatarUrl(row._id, person?.avatarUrl), countryCode: person?.countryCode ?? null,
      walletBalanceUnits: row.walletBalanceUnits, coinBalance: row.coinBalance, lifetimeEarnedUnits: row.walletBalanceUnits };
  };
  const leaderboards = Object.fromEntries(rankingPeriods.map((period, index) => {
    const snapshot = snapshots[index]!;
    const self = snapshot.byId.get(String(input.userId));
    return [period, { metric: period, total: snapshot.rows.length,
      entries: snapshot.rows.slice(input.offset, input.offset + input.limit).map(entry), self: self ? entry(self) : null }];
  }));
  return { offset: input.offset, limit: input.limit, total: Math.max(...snapshots.map(s => s.rows.length)), leaderboards };
}
