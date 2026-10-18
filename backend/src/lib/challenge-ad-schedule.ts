import { bonusDay } from "./daily-bonus-schedule.js";
export const CHALLENGE_AD_DELAYS_MS = [5, 30, 60, 120, 180, 240, 300].map(minutes => minutes * 60_000);
export const CHALLENGE_AD_DAILY_LIMIT = CHALLENGE_AD_DELAYS_MS.length;
export function nextChallengeAdDeadline(now: Date, claimedCount: number): Date {
  const { resetsAt } = bonusDay(now);
  const delay = CHALLENGE_AD_DELAYS_MS[claimedCount];
  return delay === undefined ? resetsAt : new Date(Math.min(now.getTime() + delay, resetsAt.getTime()));
}
