import { expect, it } from "vitest";
import { fcmMessage, fcmReadMessage } from "../src/services/fcm-push.service.js";
const account = "111111111111111111111111", chat = "222222222222222222222222", event = "event:333333333333333333333333";
const notification = { title: "Group", body: "Hello", tag: "chat-test", data: { type: "chat_message", recipientId: account, conversationId: chat, seq: 10, inboxId: event, createdAt: "2026-11-14T12:00:00Z" } };
it("retains visible provider delivery for old APKs", () => {
  const message = fcmMessage("legacy-phone", notification).message;
  expect(message.notification).toEqual({ title: "Group", body: "Hello" }); expect(message.android.notification?.channel_id).toBe("messages");
});
it("uses data-only transport for capable APKs so native read suppression runs before display", () => {
  const message = fcmMessage("new-phone", notification, true).message;
  expect(message.notification).toBeUndefined(); expect(message.android.notification).toBeUndefined();
  expect(message.data).toMatchObject({ type: "chat_message", title: "Group", message: "Hello", recipientId: account, seq: "10" });
  expect(JSON.parse(message.data.body)).toMatchObject({ conversationId: chat, seq: 10 });
});
it("makes read controls silent and bounded, preserving the account and cutoff", () => {
  const receipt = { recipientId: account, conversationId: chat, readSeq: 10, ids: Array(80).fill(event) };
  const message = fcmReadMessage("phone", receipt).message;
  expect(message).not.toHaveProperty("notification"); expect(message.android).not.toHaveProperty("notification");
  expect(message.data.type).toBe("chat_read"); expect(message.data.readSeq).toBe("10"); expect(Buffer.byteLength(JSON.stringify(message.data))).toBeLessThan(4096);
});
it("never changes gifts or other system notifications into background controls", () => {
  expect(fcmMessage("phone", { ...notification, data: { type: "gift_received" } }, true).message.notification?.title).toBe("Group");
});
