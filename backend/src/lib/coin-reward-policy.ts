import { daysBetween } from "./date.js";
export function nextLoginSlot(previous: { dayKey: string; slot: number } | null, today: string) {
  return previous && daysBetween(previous.dayKey, today) === 1 ? previous.slot % 7 + 1 : 1;
}
export function periodRewardEligible(kind: "week" | "month", period: { from: string; to: string }, today: string, firstLogin: string, activeDays: readonly string[]) {
  const required = kind === "week" ? 7 : daysBetween(period.from, period.to) + 1 - 3;
  const count = new Set(activeDays.filter(day => day >= period.from && day <= period.to && day <= today)).size;
  return { count, required, eligible: today >= period.to && firstLogin <= period.to && count >= required };
}
