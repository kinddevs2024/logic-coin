// Coalesce bursts without cancelling an in-flight refresh. One trailing pass
// catches changes which arrived while the current HTTP request was running.
export function createSerialChatRefresh(run: () => Promise<unknown>) {
  let active: Promise<void> | null = null;
  let dirty = false;
  return () => {
    dirty = true;
    if (!active) active = (async () => {
      try { while (dirty) { dirty = false; await run(); } }
      finally { active = null; }
    })();
    return active;
  };
}
export type ChatHistoryPage<T extends { id: string; seq: number }> = { items: T[]; before: number | null; pinned?: { id: string; seq: number; text: string; hasAttachments: boolean }[] };
export async function catchUpChatHead<T extends { id: string; seq: number }>(
  fetchPage: (before?: number) => Promise<ChatHistoryPage<T>>,
  cached?: ChatHistoryPage<T>,
): Promise<ChatHistoryPage<T>> {
  const latest = await fetchPage();
  if (!cached?.items.length || !latest.items.length) return latest;
  const knownMax = Math.max(...cached.items.map(item => item.seq));
  const incoming = [...latest.items];
  let cursor = latest.before;
  // Fetch a stable backwards cursor until the previous live head is reached.
  // New arrivals cannot move this cursor and leave a hole in a busy group.
  while (cursor !== null && incoming.length && Math.min(...incoming.map(item => item.seq)) > knownMax) {
    const page = await fetchPage(cursor);
    incoming.push(...page.items);
    if (page.before !== null && page.before >= cursor) throw new Error("Invalid chat cursor");
    cursor = page.before;
  }
  const oldestFetched = incoming.length ? Math.min(...incoming.map(item => item.seq)) : Infinity;
  // The fetched range is authoritative: hidden/removed messages cannot be
  // resurrected from the old cache in that range.
  const merged = new Map(cached.items.filter(item => item.seq < oldestFetched).map(item => [item.id, item]));
  for (const item of incoming) merged.set(item.id, item);
  const all = [...merged.values()].sort((a,b) => a.seq - b.seq);
  const items = all.slice(-400);
  return { ...latest, items, before: items.length < all.length || cached.before !== null ? items[0]!.seq : cursor };
}