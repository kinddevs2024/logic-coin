import { beforeEach, expect, it, vi } from "vitest";
import { Types } from "mongoose";
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), devices: vi.fn(), events: vi.fn(), send: vi.fn(), unregister: vi.fn() }));
vi.mock("../src/models/ChatReadDelivery.js", () => ({ ChatReadDelivery: { find: mocks.find, updateOne: mocks.update } }));
vi.mock("../src/models/Device.js", () => ({ Device: { find: mocks.devices, updateMany: mocks.unregister } }));
vi.mock("../src/models/NotificationEvent.js", () => ({ NotificationEvent: { find: mocks.events } }));
vi.mock("../src/services/fcm-push.service.js", () => ({ sendFcmReadReceipt: mocks.send }));
import { deliverChatReadReceipts, queueChatReadSync } from "../src/services/chat-read-sync.service.js";
const userId = new Types.ObjectId(), chat = new Types.ObjectId().toString();
let current: { _id: string; userId: Types.ObjectId; conversationId: string; readSeq: number; revision: number; pending: boolean; attempts: number };
beforeEach(() => {
  vi.resetAllMocks(); current = { _id: `${userId}:${chat}`, userId, conversationId: chat, readSeq: 10, revision: 1, pending: true, attempts: 0 };
  mocks.find.mockImplementation(() => ({ sort: () => ({ limit: () => ({ lean: async () => [{ ...current }] }) }) }));
  mocks.devices.mockReturnValue({ select: () => ({ lean: async () => [{ fcmToken: "phone-a" }, { fcmToken: "phone-b" }, { fcmToken: "phone-a" }] }) });
  mocks.events.mockReturnValue({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [{ _id: new Types.ObjectId() }] }) }) }) });
  mocks.send.mockResolvedValue("accepted");
  mocks.update.mockImplementation(async (filter, update) => { if (filter.revision === undefined || filter.revision === current.revision) Object.assign(current, update.$set); return { matchedCount: 1 }; });
});
it("queues one monotonic receipt per account and conversation", async () => {
  await queueChatReadSync(userId, chat, 10);
  expect(mocks.update).toHaveBeenCalledWith({ _id: `${userId}:${chat}` }, expect.objectContaining({ $max: { readSeq: 10 }, $inc: { revision: 1 } }), { upsert: true });
});
it("clears all capable phones on the account while deduplicating tokens", async () => {
  await deliverChatReadReceipts();
  expect(mocks.devices).toHaveBeenCalledWith(expect.objectContaining({ userId, platform: "android", notificationSyncVersion: 1 }));
  expect(mocks.send).toHaveBeenCalledTimes(2); expect(mocks.send.mock.calls.map(call => call[0]).sort()).toEqual(["phone-a", "phone-b"]);
  expect(mocks.send.mock.calls[0]?.[1]).toMatchObject({ recipientId: String(userId), conversationId: chat, readSeq: 10 }); expect(current.pending).toBe(false);
});
it("does not send silent controls to legacy devices", async () => {
  mocks.devices.mockReturnValue({ select: () => ({ lean: async () => [] }) });
  await deliverChatReadReceipts(); expect(mocks.send).not.toHaveBeenCalled(); expect(current.pending).toBe(false);
});
it("keeps a failed provider delivery pending for a later retry", async () => {
  mocks.send.mockRejectedValue(new Error("offline provider")); await deliverChatReadReceipts();
  expect(current.pending).toBe(true); expect(current.attempts).toBe(1);
  expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 1 }), expect.objectContaining({ $set: expect.objectContaining({ nextAttemptAt: expect.any(Date) }) }));
});
it("never discards a newer read that arrives during delivery", async () => {
  mocks.send.mockImplementation(async () => { current.readSeq = 11; current.revision = 2; return "accepted"; });
  await deliverChatReadReceipts(); expect(current.pending).toBe(true); expect(current.readSeq).toBe(11);
});
it("chunks old notification identifiers to fit FCM's data payload limit", async () => {
  const events = Array.from({ length: 161 }, () => ({ _id: new Types.ObjectId() }));
  mocks.events.mockReturnValue({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => events }) }) }) });
  await deliverChatReadReceipts(); expect(mocks.send).toHaveBeenCalledTimes(6);
  const forA = mocks.send.mock.calls.filter(call => call[0] === "phone-a").map(call => call[1]);
  expect(forA.map(receipt => receipt.ids.length)).toEqual([80, 80, 1]);
});
