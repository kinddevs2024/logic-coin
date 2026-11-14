import { beforeEach, expect, it, vi } from "vitest";
import { Types } from "mongoose";
const mocks = vi.hoisted(() => ({ room: vi.fn(), member: vi.fn(), update: vi.fn(), members: vi.fn(), user: vi.fn(), events: vi.fn(), readKnown: vi.fn(), readWrite: vi.fn(), queue: vi.fn(), notify: vi.fn(), changed: vi.fn() }));
vi.mock("../src/models/Chat.js", () => ({ ChatConversation: { findById: mocks.room }, ChatMember: { findOne: mocks.member, updateOne: mocks.update, distinct: mocks.members }, ChatMessage: {}, ChatAttachment: {}, ChatBlock: {}, ChatReport: {}, ChatVoiceReceipt: {}, ChatFriendship: {} }));
vi.mock("../src/models/User.js", () => ({ User: { findById: mocks.user } }));
vi.mock("../src/models/NotificationEvent.js", () => ({ NotificationEvent: { find: mocks.events } }));
vi.mock("../src/models/NotificationRead.js", () => ({ NotificationRead: { distinct: mocks.readKnown, bulkWrite: mocks.readWrite } }));
vi.mock("../src/services/chat-read-sync.service.js", () => ({ queueChatReadSync: mocks.queue }));
vi.mock("../src/services/live-updates.service.js", () => ({ notifyChatRead: mocks.notify, notifyChatChange: mocks.changed }));
import { updateChatMember } from "../src/services/chat.service.js";
const user = new Types.ObjectId(), chat = new Types.ObjectId(), eventId = new Types.ObjectId();
beforeEach(() => {
  vi.resetAllMocks(); mocks.room.mockReturnValue({ lean: async () => ({ _id: chat, kind: "group", lastSeq: 15 }) });
  mocks.member.mockReturnValue({ lean: async () => ({ _id: new Types.ObjectId(), role: "member", lastReadSeq: 10 }) });
  mocks.user.mockReturnValue({ select: () => ({ lean: async () => ({ role: "user" }) }) }); mocks.members.mockResolvedValue([user]);
  mocks.events.mockReturnValue({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [{ _id: eventId }] }) }) }) });
  mocks.readKnown.mockResolvedValue([]); mocks.readWrite.mockResolvedValue({}); mocks.update.mockResolvedValue({}); mocks.queue.mockResolvedValue({});
});
it("returns the canonical account read position for a stale notification tap", async () => {
  const result = await updateChatMember(user, String(chat), { readSeq: 3 });
  expect(result).toMatchObject({ readSeq: 10, readIds: [`event:${eventId}`] });
  expect(mocks.queue).toHaveBeenCalledWith(user, String(chat), 10);
  expect(mocks.notify).toHaveBeenCalledWith(String(user), { recipientId: String(user), conversationId: String(chat), readSeq: 10, ids: [`event:${eventId}`] });
});
it("clamps the receipt to the actual final message and does not re-write existing notification reads", async () => {
  mocks.readKnown.mockResolvedValue([`event:${eventId}`]);
  const result = await updateChatMember(user, String(chat), { readSeq: 100 });
  expect(result.readSeq).toBe(15); expect(mocks.readWrite).not.toHaveBeenCalled(); expect(mocks.queue).toHaveBeenCalledWith(user, String(chat), 15);
});
it("does not broadcast a read receipt when changing mute or pin preferences", async () => {
  await updateChatMember(user, String(chat), { muted: true }); expect(mocks.queue).not.toHaveBeenCalled(); expect(mocks.notify).not.toHaveBeenCalled();
});
