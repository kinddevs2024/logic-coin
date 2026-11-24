const MAX_TIMER_DELAY_MS = 2_147_483_647;
const RATE_LIMIT_WINDOW_MS = 60_000;

export function createProgressSyncCooldown(now = Date.now, random = Math.random) {
  let active: { accountId: string; until: number } | undefined;

  return {
    hold(accountId: string, error: unknown) {
      if (!error || typeof error !== "object" || !("status" in error) || error.status !== 429) return;
      const retry = "retryAfterMs" in error && typeof error.retryAfterMs === "number" &&
        Number.isFinite(error.retryAfterMs) && error.retryAfterMs >= 0 ? error.retryAfterMs : RATE_LIMIT_WINDOW_MS;
      // Spread retries from devices sharing a network quota.
      const until = now() + Math.max(1_000, retry) + Math.floor(random() * 5_000);
      active = { accountId, until: Math.max(active?.accountId === accountId ? active.until : 0, until) };
    },
    until(accountId: string) {
      return active?.accountId === accountId ? active.until : 0;
    },
  };
}

/** One in-flight progress PUT. Failed saves stay queued until the backoff expires. */
export function createProgressSyncQueue<T>(
  save: (value: T) => Promise<unknown>,
  delayMs = 5_000,
  retryMs = 30_000,
  pausedUntil: () => number = () => 0,
) {
  let latest: { value: T; key: string } | null = null;
  let savedKey: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let disposed = false;
  let lastStarted = -Infinity;
  let nextRetryAt = 0;
  let retryDelay = retryMs;
  const maxRetryDelay = Math.max(retryMs, 5 * 60_000);
  const earliestWrite = () => Math.max(lastStarted + delayMs, nextRetryAt, pausedUntil());

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const arm = (delay: number) => {
    if (disposed || timer !== undefined || running) return;
    timer = setTimeout(() => {
      timer = undefined;
      void flush();
    }, Math.min(delay, MAX_TIMER_DELAY_MS));
  };

  async function flush() {
    if (disposed || running || !latest) return;
    clear();
    if (latest.key === savedKey) {
      latest = null;
      return;
    }
    const now = Date.now();
    const wait = earliestWrite() - now;
    if (wait > 0) {
      arm(wait);
      return;
    }
    const entry = latest;
    latest = null;
    running = true;
    lastStarted = now;
    try {
      await save(entry.value);
      savedKey = entry.key;
      nextRetryAt = 0;
      retryDelay = retryMs;
    } catch {
      latest ??= entry;
      nextRetryAt = Date.now() + retryDelay;
      retryDelay = Math.min(maxRetryDelay, retryDelay * 2);
    } finally {
      running = false;
      if (latest) arm(Math.max(0, earliestWrite() - Date.now()));
    }
  }

  return {
    schedule(value: T) {
      if (disposed) return;
      const key = JSON.stringify(value);
      if (key === savedKey && !running) {
        latest = null;
        clear();
        return;
      }
      latest = { value, key };
      arm(Math.max(delayMs, earliestWrite() - Date.now()));
    },
    markSynced(value: T) { savedKey = JSON.stringify(value); },
    flush,
    dispose() {
      disposed = true;
      clear();
      latest = null;
    },
  };
}
