import { existsSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";
import { env } from "../config/env.js";

export function fcmConfigured() {
  return Boolean(env.FCM_SERVICE_ACCOUNT_FILE && existsSync(env.FCM_SERVICE_ACCOUNT_FILE));
}
const auth = new GoogleAuth({ ...(env.FCM_SERVICE_ACCOUNT_FILE ? { keyFile: env.FCM_SERVICE_ACCOUNT_FILE } : {}), scopes: ["https://www.googleapis.com/auth/firebase.messaging"] });

export function fcmMessage(token: string, notification: { title: string; body: string; tag: string; data: Record<string, unknown> }, dataOnlyChat = false) {
  const id = notification.data.inboxId;
  const createdAt = notification.data.createdAt;
  const tag = typeof id === "string" && /^(event|gift|result):[a-f\d]{24}$/i.test(id) && typeof createdAt === "string" && Number.isFinite(Date.parse(createdAt))
    ? `logic-inbox:${id}@${createdAt}` : notification.tag;
  const dataOnly = dataOnlyChat && notification.data.type === "chat_message";
  return { message: { token, ...(dataOnly ? {} : { notification: { title: notification.title, body: notification.body } }),
    // Expo Android maps FCM data.body JSON to notification.content.data.
    // Keep top-level routing strings too for native launch-intent handling.
    data: { ...Object.fromEntries(Object.entries(notification.data).filter(([, value]) => value != null).map(([key, value]) => [key, String(value)])),
      body: JSON.stringify(notification.data), tag,
      ...(dataOnly ? { title: notification.title, message: notification.body, channelId: "messages", sound: "default" } : {}) },
    android: { priority: "HIGH", ...(typeof notification.data.expiresAt === "string" ? { ttl: `${Math.max(0, Math.ceil((Date.parse(notification.data.expiresAt) - Date.now()) / 1000))}s` } : {}), ...(dataOnly ? {} : { notification: { channel_id: "messages", tag, sound: "default" } }) } } };
}

export async function sendFcmPush(token: string, notification: Parameters<typeof fcmMessage>[1], fetchImplementation: typeof fetch = fetch, dataOnlyChat = false) {
  if (!fcmConfigured()) throw new Error("fcm:not_configured");
  try {
    const project = await auth.getProjectId();
    const accessToken = await auth.getAccessToken();
    if (!project || !accessToken) throw new Error("auth");
    const response = await fetchImplementation(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`, {
      method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(fcmMessage(token, notification, dataOnlyChat)), signal: AbortSignal.timeout(8000)
    });
    const result = await response.json() as { name?: string; error?: { details?: Array<{ errorCode?: string }> } };
    if (result.error?.details?.some(detail => detail.errorCode === "UNREGISTERED")) return "unregistered" as const;
    if (!response.ok || !result.name) throw new Error("rejected");
    return "accepted" as const; // Provider acceptance is not device delivery confirmation.
  } catch { throw new Error("fcm:delivery_error"); } // Never expose credentials or device tokens.
}

export type FcmReadReceipt = { recipientId: string; conversationId: string; readSeq: number; ids: string[] };
export function fcmReadMessage(token: string, receipt: FcmReadReceipt) {
  if (!/^[a-f\d]{24}$/i.test(receipt.recipientId) || !/^[a-f\d]{24}$/i.test(receipt.conversationId) || !Number.isSafeInteger(receipt.readSeq) || receipt.readSeq < 0 || receipt.ids.length > 80 || receipt.ids.some(id => !/^event:[a-f\d]{24}$/i.test(id))) throw new Error("Invalid read receipt");
  return { message: { token, data: { type: "chat_read", recipientId: receipt.recipientId, conversationId: receipt.conversationId, readSeq: String(receipt.readSeq), ids: JSON.stringify(receipt.ids) }, android: { priority: "HIGH", ttl: "86400s" } } };
}
export async function sendFcmReadReceipt(token: string, receipt: FcmReadReceipt, fetchImplementation: typeof fetch = fetch) {
  if (!fcmConfigured()) throw new Error("fcm:not_configured");
  try {
    const project = await auth.getProjectId(), accessToken = await auth.getAccessToken();
    if (!project || !accessToken) throw new Error("auth");
    const response = await fetchImplementation(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`, { method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify(fcmReadMessage(token, receipt)), signal: AbortSignal.timeout(8000) });
    const result = await response.json() as { name?: string; error?: { details?: Array<{ errorCode?: string }> } };
    if (result.error?.details?.some(detail => detail.errorCode === "UNREGISTERED")) return "unregistered" as const;
    if (!response.ok || !result.name) throw new Error("rejected");
    return "accepted" as const;
  } catch { throw new Error("fcm:read_sync_delivery_error"); }
}
