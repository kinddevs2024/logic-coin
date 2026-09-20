import { referralFromUrl } from "./first-visit";

export const REGISTRATION_REFERRAL_KEY = "logic-coin-registration-referral-v1";
type ReferralState = { version: 1; referralCode: string | null };
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };

// The visitor's original source is separate from a pending registration invite.
// An installed app can receive its first invite long after its first launch.
export function createRegistrationReferralTracker(storage: Storage) {
  let state: ReferralState | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;
  };
  const save = async () => {
    try { await storage.setItem(REGISTRATION_REFERRAL_KEY, JSON.stringify(state)); } catch { /* Keep in memory if storage is unavailable. */ }
  };
  return {
    initialize: (legacyCode?: string | null) => enqueue(async () => {
      if (state) return;
      try {
        const saved = JSON.parse(await storage.getItem(REGISTRATION_REFERRAL_KEY) ?? "null") as ReferralState | null;
        if (saved?.version === 1 && (saved.referralCode === null ||
          (typeof saved.referralCode === "string" && /^[A-Z0-9-]{4,32}$/.test(saved.referralCode)))) state = saved;
      } catch { /* Use the legacy first-visit source once. */ }
      state ??= { version: 1, referralCode: legacyCode ?? null };
      await save();
    }),
    capture: (url: string) => enqueue(async () => {
      const code = referralFromUrl(url);
      if (!code || state?.referralCode) return;
      state = { version: 1, referralCode: code };
      await save();
    }),
    get: () => enqueue(async () => state?.referralCode ?? undefined),
    clear: () => enqueue(async () => {
      // Persist a tombstone so an old first-visit referral is not reused on logout.
      state = { version: 1, referralCode: null };
      await save();
    }),
  };
}
