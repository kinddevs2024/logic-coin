import type { Types } from "mongoose";
import { ChatReadDelivery } from "../models/ChatReadDelivery.js";
import { Device } from "../models/Device.js";
import { NotificationEvent } from "../models/NotificationEvent.js";
import { sendFcmReadReceipt } from "./fcm-push.service.js";

export async function queueChatReadSync(userId: Types.ObjectId, conversationId: string, readSeq: number) {
  await ChatReadDelivery.updateOne({ _id: `${userId}:${conversationId}` }, {
    $max: { readSeq }, $inc: { revision: 1 },
    $set: { userId, conversationId, pending: true, attempts: 0, nextAttemptAt: new Date() },
  }, { upsert: true });
}

/** Durable, coalesced receipts retry provider failures without blocking chat reads. */
export async function deliverChatReadReceipts() {
  const pending = await ChatReadDelivery.find({ pending: true, nextAttemptAt: { $lte: new Date() } }).sort({ nextAttemptAt: 1 }).limit(20).lean();
  for (const receipt of pending) {
    try {
      const [devices, events] = await Promise.all([
        // Legacy APKs cannot handle silent controls. Sending them one would
        // create an empty notification instead of clearing a previous one.
        Device.find({ userId: receipt.userId, platform: "android", notificationSyncVersion: 1, fcmToken: { $exists: true, $ne: "" } }).select("fcmToken").lean(),
        NotificationEvent.find({ type: "chat_message", "payload.conversationId": receipt.conversationId, "payload.seq": { $lte: receipt.readSeq }, "payload.userIds": String(receipt.userId) }).select("_id").sort({ createdAt: -1 }).limit(500).lean(),
      ]);
      const ids = events.map(event => `event:${event._id}`), tokens = [...new Set(devices.map(device => device.fcmToken).filter((token): token is string => Boolean(token)))];
      for (let offset = 0; offset < Math.max(1, ids.length); offset += 80) {
        const group = ids.slice(offset, offset + 80);
        await Promise.all(tokens.map(async token => {
          const status = await sendFcmReadReceipt(token, { recipientId: String(receipt.userId), conversationId: receipt.conversationId, readSeq: receipt.readSeq, ids: group });
          if (status === "unregistered") await Device.updateMany({ fcmToken: token }, { $unset: { fcmToken: 1 } });
        }));
      }
      // A newer read arriving during delivery stays pending for the next pass.
      await ChatReadDelivery.updateOne({ _id: receipt._id, revision: receipt.revision }, { $set: { pending: false } });
    } catch {
      const attempts = receipt.attempts + 1;
      await ChatReadDelivery.updateOne({ _id: receipt._id, revision: receipt.revision }, { $set: { attempts, nextAttemptAt: new Date(Date.now() + Math.min(300000, 1000 * 2 ** Math.min(attempts, 8))) } });
    }
  }
}
export function startChatReadSyncWorker() {
  let busy = false;
  const tick = async () => { if (busy) return; busy = true; try { await deliverChatReadReceipts(); } catch { /* Durable receipts remain pending. */ } finally { busy = false; } };
  const timer = setInterval(() => { void tick(); }, 1000);
  return () => clearInterval(timer);
}
