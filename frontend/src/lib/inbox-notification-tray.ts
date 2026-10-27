/** Shared inbox identities keep OS notifications and server read receipts aligned. */
const inboxId = /^(event|gift|result):[a-f\d]{24}$/i;
const objectId = /^[a-f\d]{24}$/i;

function nativeInboxTag(identifier?: string): { id: string; createdAt: string } | undefined {
  if (!identifier) return;
  let tag = identifier;
  if (identifier.startsWith("expo-notifications://foreign_notifications?")) {
    try {
      const encoded = identifier.split("?")[1]?.split("&").find(part => part.startsWith("tag="))?.slice(4);
      if (!encoded) return;
      tag = decodeURIComponent(encoded);
    } catch { return; }
  }
  const match = /^logic-inbox:((?:event|gift|result):[a-f\d]{24})@(.+)$/i.exec(tag);
  if (!match || !Number.isFinite(Date.parse(match[2]!))) return;
  return { id: match[1]!, createdAt: match[2]! };
}

export function inboxNotificationCreatedAt(data: unknown, identifier?: string): unknown {
  const value = data && typeof data === "object" ? data as Record<string, unknown> : {};
  return value.createdAt ?? nativeInboxTag(identifier)?.createdAt;
}

export function inboxNotificationIds(data: unknown, identifier?: string): string[] {
  const value = data && typeof data === "object" ? data as Record<string, unknown> : {};
  if (typeof value.inboxId === "string" && inboxId.test(value.inboxId)) return [value.inboxId];
  if (typeof value.giftId === "string" && objectId.test(value.giftId)) return [`gift:${value.giftId}`];
  if (typeof value.eventId === "string" && objectId.test(value.eventId)) return [`event:${value.eventId}`];
  const native = nativeInboxTag(identifier);
  return native ? [native.id] : [];
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
