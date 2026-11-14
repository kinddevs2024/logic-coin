import { afterEach, expect, it, vi } from "vitest";
import { notificationPayload } from "../src/lib/notification-payload";
import { notificationChatRoute } from "../src/lib/notification-chat-route";
import { beginCacheBoot } from "../src/lib/cache-boot";
const chat = "111111111111111111111111", account = "222222222222222222222222", event = "event:333333333333333333333333";
afterEach(() => vi.useRealTimers());
it("reads foreground, background and legacy Android launch payloads identically", () => {
  const data = { conversationId: chat, inboxId: event, recipientId: account };
  for (const value of [data, { body: JSON.stringify(data) }, { dataString: JSON.stringify(data) }, { data: { body: JSON.stringify(data) } }]) expect(notificationPayload(value)).toMatchObject(data);
});
it("opens the conversation from a legacy URL even if the notification was already read", () => {
  const data = notificationPayload({ body: JSON.stringify({ url: `/messages?chat=${chat}`, read: true }) });
  expect(data.conversationId).toBe(chat);
  expect(notificationChatRoute({ id: chat, account }, { ready: true, active: true, authenticated: true, account, token: "fixture" })?.params.chat).toBe(chat);
});
it("rejects another account and waits for the navigator rather than losing a cold-start tap", () => {
  const pending = { id: chat, account };
  const state = { ready: true, active: true, authenticated: true, account, token: "fixture" };
  expect(notificationChatRoute(pending, { ...state, ready: false })).toBeNull();
  expect(notificationChatRoute(pending, { ...state, account: chat })).toBeNull();
  expect(notificationChatRoute(pending, state)?.params.chat).toBe(chat);
});
it("does not accept external URL routes or crash on malformed payloads", () => {
  expect(notificationPayload({ url: `https://example.com/messages?chat=${chat}` }).conversationId).toBeUndefined();
  expect(notificationPayload({ body: "{bad" })).toBeDefined();
  expect(notificationPayload(null)).toEqual({});
});
it("unblocks navigation when reading the local cache fails", async () => {
  const ready = vi.fn(), loaded = vi.fn();
  beginCacheBoot(() => Promise.reject(new Error("Storage unavailable")), loaded, ready);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(ready).toHaveBeenCalledOnce(); expect(loaded).not.toHaveBeenCalled();
});
it("unblocks a stalled cache and marks its eventual snapshot as late", async () => {
  vi.useFakeTimers(); let resolve!: (value: string[]) => void;
  const loaded = vi.fn(), ready = vi.fn(); beginCacheBoot(() => new Promise<string[]>(done => { resolve = done; }), loaded, ready);
  await vi.advanceTimersByTimeAsync(4001); expect(ready).toHaveBeenCalledOnce();
  resolve(["old snapshot"]); await vi.runAllTimersAsync(); expect(loaded).toHaveBeenCalledWith(["old snapshot"], true);
});
it("never restores a previous account after the cache boundary was cancelled", async () => {
  let resolve!: (value: string[]) => void; const ready = vi.fn(), loaded = vi.fn();
  const cancel = beginCacheBoot(() => new Promise<string[]>(done => { resolve = done; }), loaded, ready);
  await Promise.resolve(); cancel(); resolve(["old account"]); await new Promise(done => setTimeout(done, 0));
  expect(ready).not.toHaveBeenCalled(); expect(loaded).not.toHaveBeenCalled();
});
