let openedAt: number | null = null;
export function markNotificationOpen(now = Date.now()) { openedAt = now; }
/** Let an explicit notification action reach its destination before any ad. */
export function notificationOpenRecently(now = Date.now()) { return openedAt !== null && now >= openedAt && now - openedAt < 15000; }
