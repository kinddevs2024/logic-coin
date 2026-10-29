type Entry = { expires: number; value: Promise<unknown> };
const entries = new Map<string, Entry>();
// Only shared catalog/top-list data belongs here; balances and authorization
// are always read fresh. Single-flight also prevents duplicate cold reads.
export async function cachedRead<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const old = entries.get(key);
  if (old && old.expires > Date.now()) return old.value as Promise<T>;
  if (entries.size >= 128) entries.delete(entries.keys().next().value!);
  const entry: Entry = { expires: Infinity, value: Promise.resolve().then(load) };
  entries.set(key, entry);
  try {
    const result = await entry.value as T;
    entry.expires = Date.now() + ttlMs;
    return result;
  } catch (error) {
    if (entries.get(key) === entry) entries.delete(key);
    throw error;
  }
}
export function invalidateReadCache() { entries.clear(); }
