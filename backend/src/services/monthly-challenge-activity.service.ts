import { Types } from "mongoose";
import { currentMonthBounds, currentWeekBounds } from "../lib/date.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { DailyContestResult } from "../models/DailyContestResult.js";

function countCompletedPeriodDays(dayKey: string, period: { from: string; to: string }, attempts: readonly { dayKey: string; gameId: string }[], sets: readonly { dayKey: string; gameIds: readonly string[] }[], savedDays: readonly string[]) {
  const inMonth = (value: string) => value >= period.from && value <= period.to && value <= dayKey;
  const closed = new Set(savedDays.filter(inMonth));
  const completed = new Map<string, Set<string>>();
  for (const attempt of attempts) {
    if (!inMonth(attempt.dayKey)) continue;
    const games = completed.get(attempt.dayKey) ?? new Set<string>();
    games.add(attempt.gameId); completed.set(attempt.dayKey, games);
  }
  for (const set of sets) {
    if (!inMonth(set.dayKey) || new Set(set.gameIds).size !== 6) continue;
    const played = completed.get(set.dayKey);
    if (played && set.gameIds.every(game => played.has(game))) closed.add(set.dayKey);
  }
  return closed.size;
}
export function countCompletedMonthDays(dayKey: string, attempts: readonly { dayKey: string; gameId: string }[], sets: readonly { dayKey: string; gameIds: readonly string[] }[], savedDays: readonly string[]) {
  const month = currentMonthBounds(dayKey);
  return { completedDays: countCompletedPeriodDays(dayKey, month, attempts, sets, savedDays), daysInMonth: Number(month.to.slice(8, 10)) };
}
export function countCompletedWeekDays(dayKey: string, attempts: readonly { dayKey: string; gameId: string }[], sets: readonly { dayKey: string; gameIds: readonly string[] }[], savedDays: readonly string[]) {
  return countCompletedPeriodDays(dayKey, currentWeekBounds(dayKey), attempts, sets, savedDays);
}

export async function getMonthlyChallengeActivity(userId: Types.ObjectId, dayKey: string) {
  const month = currentMonthBounds(dayKey);
  const week = currentWeekBounds(dayKey);
  const range = { $gte: month.from < week.from ? month.from : week.from, $lte: dayKey };
  const [attempts, sets, results] = await Promise.all([
    ChallengeAttempt.find({ userId, dayKey: range, mode: "challenge", status: "completed" }).select("dayKey gameId").lean(),
    DailyChallengeSet.find({ dayKey: range }).select("dayKey gameIds").lean(),
    DailyContestResult.find({ userId, dayKey: range, completedGamesCount: 6 }).select("dayKey").lean(),
  ]);
  const played = attempts.flatMap(row => row.dayKey ? [{ dayKey: row.dayKey, gameId: row.gameId.toString() }] : []);
  const published = sets.map(row => ({ dayKey: row.dayKey, gameIds: row.gameIds.map(String) }));
  const saved = results.map(row => row.dayKey);
  return { ...countCompletedMonthDays(dayKey, played, published, saved), weeklyCompletedDays: countCompletedWeekDays(dayKey, played, published, saved) };
}
