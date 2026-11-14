import { expect, it } from "vitest";
import { notificationChatRoute } from "../src/lib/notification-chat-route";
const pending = { id: "333333333333333333333333", account: "owner" };
const ready = { ready: true, active: true, authenticated: true, account: "owner", token: "session" };
it("holds a cold-start notification until navigation is mounted", () => {
  expect(notificationChatRoute(pending, {...ready, ready: false})).toBeNull();
  expect(notificationChatRoute(pending, ready)?.params.chat).toBe(pending.id);
});
it("holds a background tap until Android resumes", () => {
  expect(notificationChatRoute(pending, {...ready, active: false})).toBeNull();
  expect(notificationChatRoute(pending, ready)?.pathname).toBe("/(tabs)/messages");
});
it("does not open a previous account's notification or unauthenticated route", () => {
  expect(notificationChatRoute(pending, {...ready, account: "other"})).toBeNull();
  expect(notificationChatRoute(pending, {...ready, authenticated: false})).toBeNull();
  expect(notificationChatRoute(pending, {...ready, token: null})).toBeNull();
});
it("clears old search and invite params and ignores malformed targets", () => {
  expect(notificationChatRoute(pending, ready)?.params).toEqual({chat: pending.id, invite: "", messageSearch: ""});
  expect(notificationChatRoute({...pending, id: "bad"}, ready)).toBeNull();
  expect(notificationChatRoute(null, ready)).toBeNull();
});
