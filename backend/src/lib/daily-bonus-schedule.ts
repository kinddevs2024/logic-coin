import { dayBoundsInTimeZone, localDayKey } from "./date.js";

export const DAILY_BONUS_LIMIT = 10;
export const DAILY_BONUS_DELAYS_MS = [2, 5, 15, 30, 60, 120, 180, 240, 300, 420].map(minutes => minutes * 60_000);
export const BONUS_TIMEZONE = "Asia/Tashkent";

export function bonusDay(now: Date) {
  const dayKey = localDayKey(now, BONUS_TIMEZONE);
  return { dayKey, resetsAt: dayBoundsInTimeZone(dayKey, BONUS_TIMEZONE).to };
}

export function nextBonusDeadline(now: Date, claimedCount: number): Date {
  const { resetsAt } = bonusDay(now);
  const delay = DAILY_BONUS_DELAYS_MS[claimedCount];
  if (delay === undefined) return resetsAt;
  return new Date(Math.min(now.getTime() + delay, resetsAt.getTime()));
}
