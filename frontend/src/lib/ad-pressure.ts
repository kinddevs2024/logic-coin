// Pace unsolicited ads separately from voluntary, server-verified rewards.
export const FORCED_AD_INTERVAL_MS = 3 * 60_000;
export const APP_OPEN_BACKGROUND_MS = 15 * 60_000;

export function createAdPressure(now: () => number = Date.now) {
  let lastActivityAt = now();
  let busy = false;
  let rewardsInFlight = 0;
  return {
    async forced(show: () => Promise<boolean>): Promise<boolean> {
      if (busy || rewardsInFlight || now() - lastActivityAt < FORCED_AD_INTERVAL_MS) return false;
      busy = true;
      lastActivityAt = now();
      try { return await show(); }
      finally { busy = false; lastActivityAt = now(); }
    },
    async rewarded<T>(show: () => Promise<T>): Promise<T> {
      rewardsInFlight++;
      lastActivityAt = now();
      try { return await show(); }
      finally { rewardsInFlight--; lastActivityAt = now(); }
    },
  };
}
