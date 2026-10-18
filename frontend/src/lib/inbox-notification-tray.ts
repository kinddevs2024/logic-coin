/** Shared inbox identities keep OS notifications and server read receipts aligned. */
const inboxId = /^(event|gift|result):[a-f\d]{24}$/i;
const objectId = /^[a-f\d]{24}$/i;

export function inboxNotificationIds(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const value = data as Record<string, unknown>;
  if (typeof value.inboxId === "string" && inboxId.test(value.inboxId)) return [value.inboxId];
  if (typeof value.giftId === "string" && objectId.test(value.giftId)) return [`gift:${value.giftId}`];
  if (typeof value.eventId === "string" && objectId.test(value.eventId)) return [`event:${value.eventId}`];
  return [];
}

export function beforeReadCutoff(createdAt: unknown, receivedAt: number, before?: string) {
  if (!before) return true;
  const cutoff = Date.parse(before);
  const created = typeof createdAt === "string" ? Date.parse(createdAt) : receivedAt;
  return Number.isFinite(cutoff) && Number.isFinite(created) && created <= cutoff;
}

export function unseenInboxItems<T extends { id: string; createdAt: string; read: boolean }>(items: T[], seen: ReadonlySet<string>) {
  return items.filter(item => !item.read && inboxId.test(item.id) && !seen.has(item.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
