import { addDays } from "./date.js";

export const NAVIGATION_CHALLENGE_REWARD = 45;

export function challengeAdRewardDay(today: string, set: { status: string; endsAt?: Date | null } | null, now: Date): string {
  return set?.status === "published" && set.endsAt && set.endsAt.getTime() > now.getTime()
    ? today : addDays(today, 1);
}
