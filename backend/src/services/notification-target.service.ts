import type { Types } from "mongoose";
import { NotificationEvent } from "../models/NotificationEvent.js";
import { ChatMember } from "../models/Chat.js";
/** Routing lookup remains valid after the notice is marked read on any device. */
export async function chatNotificationTarget(userId: Types.ObjectId, notificationId: string) {
  if (!/^event:[a-f\d]{24}$/i.test(notificationId)) return null;
  const event = await NotificationEvent.findOne({ _id: notificationId.slice(6), type: "chat_message", audience: "specific_users", "payload.userIds": String(userId) }).select("payload.conversationId").lean();
  const conversationId = (event?.payload as { conversationId?: unknown } | undefined)?.conversationId;
  if (typeof conversationId !== "string" || !/^[a-f\d]{24}$/i.test(conversationId)) return null;
  if (!await ChatMember.exists({ conversationId, userId, leftAt: { $exists: false } })) return null;
  return { conversationId };
}
