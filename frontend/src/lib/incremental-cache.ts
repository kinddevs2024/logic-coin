export type CacheStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
export type CachedResponse = { body: unknown; etag: string; savedAt: number };
const KEY = "logiccoin-data-cache-v1";
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const PART_LIMIT = 175_000; // Both parts stay below Android's per-row storage limit.

export function cacheableRead(path: string): boolean {
  return /^\/(bootstrap|home|games|challenges\/(today|rules)|wallet|activity|leaderboard|notifications|chat|tasks|bonuses|referrals|me)(?:\/|\?|$)/.test(path);
}

/** Account/language-scoped snapshots. Authentication tokens are never stored here. */
export class IncrementalCache {
  scope: string | null = null;
  ready = false;
  generation = 0;
  private responses = new Map<string, CachedResponse>();
  private queries: unknown[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private writes: Promise<unknown> = Promise.resolve();

  constructor(private storage: CacheStorage, private now = Date.now) {}

  async open(scope: string | null): Promise<unknown[]> {
    const generation = ++this.generation;
    clearTimeout(this.timer);
    this.scope = scope;
    this.ready = false;
    this.responses.clear();
    this.queries = [];
    await this.writes;
    try {
      const raw = await this.storage.getItem(KEY);
      if (generation !== this.generation) return [];
      const saved = raw ? JSON.parse(raw) : null;
      if (scope && saved?.version === 1 && saved.scope === scope && this.now() - saved.savedAt < MAX_AGE) {
        for (const [key, value] of saved.responses ?? []) {
          if (typeof key === "string" && cacheableRead(key) && typeof value?.etag === "string" && this.now() - value.savedAt < MAX_AGE) this.responses.set(key, value);
        }
        this.queries = Array.isArray(saved.queries) ? saved.queries : [];
      } else {
        await this.storage.removeItem(KEY);
      }
    } catch {
      if (generation !== this.generation) return [];
      // A damaged/full/unavailable cache must never prevent login or network access.
      this.responses.clear();
      this.queries = [];
    }
    if (generation !== this.generation) return [];
    this.ready = true;
    return this.queries;
  }

  get(path: string): CachedResponse | undefined {
    const entry = this.responses.get(path);
    return entry && this.now() - entry.savedAt < MAX_AGE ? entry : undefined;
  }

  put(path: string, entry: CachedResponse, generation: number) {
    if (!this.ready || !this.scope || generation !== this.generation || !cacheableRead(path)) return;
    if (JSON.stringify(entry).length > 60_000) return;
    this.responses.delete(path);
    this.responses.set(path, entry);
    while (JSON.stringify([...this.responses]).length > PART_LIMIT) this.responses.delete(this.responses.keys().next().value!);
    this.schedule();
  }

  setQueries(queries: unknown[]) {
    if (!this.ready || !this.scope) return;
    const selected: unknown[] = [];
    let size = 0;
    for (const query of queries) {
      const length = JSON.stringify(query).length;
      if (length > 60_000 || size + length > PART_LIMIT) continue;
      selected.push(query);
      size += length;
    }
    this.queries = selected;
    this.schedule();
  }

  private schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, 500);
  }

  flush(): Promise<unknown> {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.scope || !this.ready) return this.writes;
    const raw = JSON.stringify({ version: 1, scope: this.scope, savedAt: this.now(), responses: [...this.responses], queries: this.queries });
    this.writes = this.writes.then(() => this.storage.setItem(KEY, raw)).catch(() => {});
    return this.writes;
  }
}

export function revalidatedBody(body: unknown, serverTime: string | null): unknown {
  if (!serverTime || !Number.isFinite(Date.parse(serverTime)) || !body || typeof body !== "object") return body;
  const value = body as { data?: { serverNow?: string } };
  return typeof value.data?.serverNow === "string" ? { ...value, data: { ...value.data, serverNow: serverTime } } : body;
}
