// Push only: no fetch handler, asset cache or stale-page interception.
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Always show a visible notification. */ }
  event.waitUntil(self.registration.showNotification(payload.title || "Logic Coin", {
    body: payload.body || "У вас новое уведомление.",
    icon: "/push-icon.png", badge: "/push-icon.png", tag: payload.tag || "logic-coin",
    data: { ...(payload.data || {}), url: "/?notifications=1" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const destination = new URL("/?notifications=1", self.location.origin);
  const id = event.notification.data?.inboxId;
  if (typeof id === "string" && /^(event|gift|result):[a-f\d]{24}$/i.test(id)) destination.searchParams.set("notificationId", id);
  const target = destination.href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(target); await existing.focus(); }
    else await self.clients.openWindow(target);
  })());
});
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
