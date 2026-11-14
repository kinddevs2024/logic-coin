// Push only: no fetch handler, asset cache or page interception.
const id24 = /^[a-f\d]{24}$/i;
let work = Promise.resolve();
function serialized(run) { work = work.catch(() => {}).then(run); return work; }
function state(key, value) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('logic-notification-read-v1', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('state');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('state', arguments.length > 1 ? 'readwrite' : 'readonly'), store = tx.objectStore('state');
      const request = arguments.length > 1 ? store.put(value, key) : store.get(key);
      let result; request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => { db.close(); resolve(result); }; tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}
async function applyRead(receipt) {
  if (!receipt || !id24.test(receipt.recipientId) || !id24.test(receipt.conversationId) || !Number.isSafeInteger(receipt.readSeq) || receipt.readSeq < 0) return;
  const key = `read:${receipt.recipientId}:${receipt.conversationId}`, cutoff = Math.max(await state(key) || 0, receipt.readSeq);
  await state(key, cutoff);
  if (await state('account') !== receipt.recipientId) return;
  const ids = new Set(Array.isArray(receipt.ids) ? receipt.ids : []);
  for (const notification of await self.registration.getNotifications()) {
    const data = notification.data || {}, legacy = /^logic-([a-f\d]{24})$/i.exec(notification.tag || '');
    const inboxId = data.inboxId || (legacy ? `event:${legacy[1]}` : null);
    if (data.recipientId && data.recipientId !== receipt.recipientId) continue;
    if (ids.has(inboxId) || (data.conversationId === receipt.conversationId && Number.isSafeInteger(data.seq) && data.seq <= cutoff)) notification.close();
  }
}
self.addEventListener('push', event => {
  let payload = {}; try { payload = event.data?.json() || {}; } catch { return; }
  event.waitUntil(serialized(async () => {
    if (payload.type === 'chat_read') { await applyRead(payload); return; }
    const data = payload.data || {};
    if (data.type === 'chat_message' && data.recipientId) {
      const account = await state('account').catch(() => undefined);
      if (account !== undefined && account !== data.recipientId) return;
      const cutoff = await state(`read:${data.recipientId}:${data.conversationId}`).catch(() => 0) || 0;
      if (Number.isSafeInteger(data.seq) && data.seq <= cutoff) return;
    }
    await self.registration.showNotification(payload.title || 'Logic Coin', { body: payload.body || '', icon: '/push-icon.png', badge: '/push-icon.png', tag: payload.tag || 'logic-coin', data });
  }));
});
self.addEventListener('message', event => {
  if (event.source?.url && new URL(event.source.url).origin !== self.location.origin) return;
  if (event.data?.type === 'logic-notification-account') event.waitUntil(serialized(async () => {
    const account = id24.test(event.data.account || '') ? event.data.account : null, prior = await state('account');
    if (prior !== account) for (const notice of await self.registration.getNotifications()) if (!notice.data?.logicUpdate) notice.close();
    await state('account', account); event.ports[0]?.postMessage({ version: 1 });
  }));
  if (event.data?.type === 'logic-chat-read') event.waitUntil(serialized(() => applyRead(event.data.receipt)));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {}, path = id24.test(data.conversationId || '') ? `/messages?chat=${data.conversationId}` : `/?notifications=1${typeof data.inboxId === 'string' ? `&notificationId=${encodeURIComponent(data.inboxId)}` : ''}`;
  const target = new URL(path, self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }), existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(target); await existing.focus(); } else await self.clients.openWindow(target);
  })());
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
