import type { Types } from "mongoose";
import { env } from "../config/env.js";
import { Device } from "../models/Device.js";
import { DailyContestResult } from "../models/DailyContestResult.js";
import { NotificationEvent } from "../models/NotificationEvent.js";
import { PushReceipt } from "../models/PushReceipt.js";
import { sendWebPush } from "./web-push.service.js";

function expoToken(value: unknown): value is string {
  return typeof value === "string" && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(value);
}
function batches<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}
const headers = () => ({
  accept: "application/json", "content-type": "application/json",
  ...(env.EXPO_PUSH_ACCESS_TOKEN ? { authorization: `Bearer ${env.EXPO_PUSH_ACCESS_TOKEN}` } : {})
});

export async function dispatchNotificationEvent(eventId: Types.ObjectId | string, fetchImplementation: typeof fetch = fetch) {
  const event = await NotificationEvent.findOneAndUpdate(
    { _id: eventId, status: "queued" },
    { $set: { status: "processing" }, $unset: { failureReason: 1 } }, { new: true }
  ).lean();
  if (!event) return { status: "skipped", targetCount: 0, sentCount: 0, failedCount: 0 };
  let targetCount = 0, sentCount = 0, failedCount = 0;
  const errors = new Set<string>();
  try {
    const payload = (event.payload ?? {}) as { dayKey?: string; gameKey?: string; title?: string; body?: string; userIds?: string[] };
    // Malformed targeted events must never become broadcasts.
    const recipients = event.audience === "specific_users"
      ? (payload.userIds ?? []).filter(id => /^[a-f\d]{24}$/i.test(id))
      : event.audience === "contest_participants"
        ? payload.dayKey ? await DailyContestResult.distinct("userId", { dayKey: payload.dayKey }) : []
        : null;
    const devices = await Device.find({
      notificationsEnabled: true,
      $or: [{ pushToken: { $exists: true, $ne: "" } }, { "webPush.endpoint": { $exists: true } }],
      ...(recipients ? { userId: { $in: recipients } } : {})
    }).select("pushToken webPush").lean();
    const tokens = [...new Set(devices.map(d => d.pushToken).filter(expoToken))];
    const webSubscriptions = [...new Map(devices.filter(d => d.webPush?.endpoint).map(d => [d.webPush!.endpoint, d.webPush!])).values()];
    targetCount = tokens.length + webSubscriptions.length;
    const notification = {
      title: payload.title ?? "Logic Coin", body: payload.body ?? "У вас новое уведомление.", tag: `logic-${event._id}`,
      data: { type: event.type, eventId: String(event._id), dayKey: payload.dayKey ?? null, gameKey: payload.gameKey ?? null, url: "/?notifications=1" }
    };
    for (const group of batches(webSubscriptions, 10)) await Promise.all(group.map(async subscription => {
      try {
        await sendWebPush({ endpoint: subscription.endpoint, keys: { p256dh: subscription.keys!.p256dh!, auth: subscription.keys!.auth! } }, notification);
        sentCount++;
      } catch (error) {
        failedCount++;
        const status = (error as { statusCode?: number }).statusCode;
        errors.add(status ? `web:${status}` : "web:delivery_error");
        if (status === 404 || status === 410) await Device.updateMany({ "webPush.endpoint": subscription.endpoint }, { $unset: { webPush: 1 } });
      }
    }));
    for (const group of batches(tokens, 100)) {
      try {
        const response = await fetchImplementation(env.EXPO_PUSH_API_URL, {
          method: "POST", headers: headers(), signal: AbortSignal.timeout(8000),
          body: JSON.stringify(group.map(to => ({ to, title: notification.title, body: notification.body, data: notification.data, sound: "default", channelId: "messages", priority: "high" })))
        });
        if (!response.ok) { failedCount += group.length; errors.add(`expo:http_${response.status}`); continue; }
        const body = await response.json() as { data?: Array<{ status?: string; id?: string; details?: { error?: string } }> };
        for (const [index, token] of group.entries()) {
          const ticket = body.data?.[index];
          if (ticket?.status === "ok") {
            sentCount++; // Accepted, not proof of delivery. Check FCM/APNs receipts later.
            if (ticket.id) await PushReceipt.updateOne({ ticketId: ticket.id }, { $setOnInsert: {
              pushToken: token, eventId: event._id, checkAfter: new Date(Date.now() + 15 * 60_000), expiresAt: new Date(Date.now() + 86400_000)
            } }, { upsert: true });
          } else {
            failedCount++;
            errors.add(`expo:${ticket?.details?.error ?? "rejected"}`);
            if (ticket?.details?.error === "DeviceNotRegistered") await Device.updateMany({ pushToken: token }, { $unset: { pushToken: 1 } });
          }
        }
      } catch { failedCount += group.length; errors.add("expo:delivery_error"); }
    }
  } catch { errors.add("dispatch_error"); failedCount = Math.max(1, targetCount - sentCount); }
  const status = errors.size ? "failed" : targetCount ? "sent" : "no_devices";
  await NotificationEvent.updateOne({ _id: event._id, status: "processing" }, { $set: {
    status, targetCount, sentCount, failedCount, processedAt: new Date(),
    ...(errors.size ? { failureReason: [...errors].join(", ").slice(0, 240) } : {})
  } });
  return { status, targetCount, sentCount, failedCount };
}

export async function checkPushReceipts(fetchImplementation: typeof fetch = fetch) {
  const pending = await PushReceipt.find({ checkAfter: { $lte: new Date() } }).limit(300).lean();
  if (!pending.length) return;
  const response = await fetchImplementation("https://exp.host/--/api/v2/push/getReceipts", {
    method: "POST", headers: headers(), signal: AbortSignal.timeout(8000), body: JSON.stringify({ ids: pending.map(r => r.ticketId) })
  });
  if (!response.ok) return;
  const result = await response.json() as { data?: Record<string, { status: string; details?: { error?: string } }> };
  for (const receipt of pending) {
    const outcome = result.data?.[receipt.ticketId];
    if (!outcome) {
      await PushReceipt.updateOne({ _id: receipt._id }, { $set: { checkAfter: new Date(Date.now() + 15 * 60_000) } });
      continue;
    }
    if (outcome.status === "error") {
      const code = outcome.details?.error ?? "unknown";
      await NotificationEvent.updateOne({ _id: receipt.eventId }, { $set: { status: "failed", failureReason: `expo_receipt:${code}` }, $inc: { failedCount: 1, sentCount: -1 } });
      if (code === "DeviceNotRegistered") await Device.updateMany({ pushToken: receipt.pushToken }, { $unset: { pushToken: 1 } });
    }
    await PushReceipt.deleteOne({ _id: receipt._id });
  }
}

// Transactional outbox: process gifts/referrals only after commit. No client polling.
export function startNotificationWorker() {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const events = await NotificationEvent.find({ status: "queued" }).sort({ createdAt: 1 }).limit(10).select("_id").lean();
      for (const event of events) await dispatchNotificationEvent(event._id);
      await checkPushReceipts();
    } catch { console.error("Notification worker could not complete its delivery pass"); }
    finally { busy = false; }
  };
  const timer = setInterval(() => { void tick(); }, 15000);
  return () => clearInterval(timer);
}
