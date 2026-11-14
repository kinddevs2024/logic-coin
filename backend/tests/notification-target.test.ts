import { beforeEach, expect, it, vi } from "vitest";
import { Types } from "mongoose";
const mocks = vi.hoisted(() => ({ event: vi.fn(), member: vi.fn() }));
vi.mock("../src/models/NotificationEvent.js", () => ({ NotificationEvent: { findOne: mocks.event } }));
vi.mock("../src/models/Chat.js", () => ({ ChatMember: { exists: mocks.member } }));
import { chatNotificationTarget } from "../src/services/notification-target.service.js";
const userId = new Types.ObjectId(), eventId = new Types.ObjectId(), chat = new Types.ObjectId().toString();
beforeEach(() => { vi.resetAllMocks(); mocks.event.mockReturnValue({ select: () => ({ lean: async () => ({ payload: { conversationId: chat } }) }) }); mocks.member.mockResolvedValue({}); });
it("resolves an already-read push independently of unread notification lists", async () => {
  expect(await chatNotificationTarget(userId, `event:${eventId}`)).toEqual({ conversationId: chat });
  expect(mocks.event).toHaveBeenCalledWith({ _id: String(eventId), type: "chat_message", audience: "specific_users", "payload.userIds": String(userId) });
});
it("does not return a private chat after the user left it", async () => { mocks.member.mockResolvedValue(null); expect(await chatNotificationTarget(userId, `event:${eventId}`)).toBeNull(); });
it("does not try to treat gifts or malformed IDs as a chat", async () => { expect(await chatNotificationTarget(userId, `gift:${eventId}`)).toBeNull(); expect(mocks.event).not.toHaveBeenCalled(); });
