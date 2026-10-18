import { existsSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";
import { env } from "../config/env.js";

export function fcmConfigured() {
  return Boolean(env.FCM_SERVICE_ACCOUNT_FILE && existsSync(env.FCM_SERVICE_ACCOUNT_FILE));
}
const auth = new GoogleAuth({ ...(env.FCM_SERVICE_ACCOUNT_FILE ? { keyFile: env.FCM_SERVICE_ACCOUNT_FILE } : {}), scopes: ["https://www.googleapis.com/auth/firebase.messaging"] });

export function fcmMessage(token: string, notification: { title: string; body: string; tag: string; data: Record<string, unknown> }) {
  return { message: { token, notification: { title: notification.title, body: notification.body },
    // Expo Android maps FCM data.body JSON to notification.content.data.
    // Keep top-level routing strings too for native launch-intent handling.
    data: { ...Object.fromEntries(Object.entries(notification.data).filter(([, value]) => value != null).map(([key, value]) => [key, String(value)])),
      body: JSON.stringify(notification.data), tag: notification.tag },
    android: { priority: "HIGH", notification: { channel_id: "messages", tag: notification.tag, sound: "default" } } } };
}

export async function sendFcmPush(token: string, notification: Parameters<typeof fcmMessage>[1], fetchImplementation: typeof fetch = fetch) {
  if (!fcmConfigured()) throw new Error("fcm:not_configured");
  try {
    const project = await auth.getProjectId();
    const accessToken = await auth.getAccessToken();
    if (!project || !accessToken) throw new Error("auth");
    const response = await fetchImplementation(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(project)}/messages:send`, {
      method: "POST", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(fcmMessage(token, notification)), signal: AbortSignal.timeout(8000)
    });
    const result = await response.json() as { name?: string; error?: { details?: Array<{ errorCode?: string }> } };
    if (result.error?.details?.some(detail => detail.errorCode === "UNREGISTERED")) return "unregistered" as const;
    if (!response.ok || !result.name) throw new Error("rejected");
    return "accepted" as const; // Provider acceptance is not device delivery confirmation.
  } catch { throw new Error("fcm:delivery_error"); } // Never expose credentials or device tokens.
}
