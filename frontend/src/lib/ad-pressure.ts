// Pace unsolicited ads separately from voluntary, server-verified rewards.
export const FORCED_AD_INTERVAL_MS = 3 * 60_000;
export const APP_OPEN_BACKGROUND_MS = 3 * 60_000;

export function createAdPressure(now: () => number = Date.now) {
  let lastActivityAt = now();
  let startupAvailable = true;
  let busy = false;
  let rewardsInFlight = 0;
  return {
    async forced(show: () => Promise<boolean>, startup = false): Promise<boolean> {
      const startupAllowed = startup && startupAvailable;
      if (busy || rewardsInFlight || (!startupAllowed && now() - lastActivityAt < FORCED_AD_INTERVAL_MS)) return false;
      startupAvailable = false;
      busy = true;
      lastActivityAt = now();
      try { return await show(); }
      finally { busy = false; lastActivityAt = now(); }
    },
    async rewarded<T>(show: () => Promise<T>): Promise<T> {
      startupAvailable = false;
      rewardsInFlight++;
      lastActivityAt = now();
      try { return await show(); }
      finally { rewardsInFlight--; lastActivityAt = now(); }
    },
  };
}
