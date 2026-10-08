import { ApiError } from "../lib/api-error.js";
import { contestPrizePlan } from "../lib/manual-contest-prizes.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { DailyContestResult } from "../models/DailyContestResult.js";
import { DailyContestSettlement } from "../models/DailyContestSettlement.js";
import { collectContestStandings } from "./contest.service.js";
import { challengeDayKey } from "./daily-challenge.service.js";
import { validHistoryDay } from "./contest-history.service.js";

export function summarizeDailyPrizes(rows: readonly { rank: number; cashUnits: number }[]) {
  return {
    podium: [1, 2, 3].map(rank => ({ rank, cashUnits: rows.find(row => row.rank === rank)?.cashUnits ?? null })),
    otherMaxCashUnits: rows.reduce((maximum, row) => row.rank > 3 ? Math.max(maximum, row.cashUnits) : maximum, 0),
    cashWinnerCount: rows.filter(row => row.cashUnits > 0).length,
  };
}

// Read the same allocation used by settlement. This never creates a challenge,
// changes a prize, settles a contest, or credits a player's balance.
export async function getDailyContestRules(day?: string) {
  const dayKey = day ?? challengeDayKey();
  if (!validHistoryDay(dayKey) || dayKey > challengeDayKey()) throw new ApiError(400, "invalid_day_key", "Invalid challenge day");
  const [set, settlement] = await Promise.all([
    DailyChallengeSet.findOne({ dayKey, status: "published" }).lean(),
    DailyContestSettlement.findOne({ dayKey, status: "settled" }).lean(),
  ]);
  if (settlement) {
    const results = await DailyContestResult.find({ dayKey }).select("rank cashUnits").lean();
    return { dayKey, source: "saved" as const, final: true, poolUnits: settlement.prizePoolUnits, participantCount: results.length,
      ...summarizeDailyPrizes(results.map(row => ({ rank: row.rank, cashUnits: row.cashUnits ?? 0 }))) };
  }
  if (!set) throw new ApiError(404, "challenge_not_found", "Challenge not found for this day");
  const source = set.manualCashPrizes == null ? "automatic" as const : "manual" as const;
  const standings = await collectContestStandings(dayKey);
  const allocation = contestPrizePlan(standings, set);
  return { dayKey, source, final: false, poolUnits: set.prizePoolUnits, participantCount: standings.length,
    ...summarizeDailyPrizes(allocation.ranked.map(row => ({ rank: row.rank, cashUnits: row.cashUnits }))) };
}
