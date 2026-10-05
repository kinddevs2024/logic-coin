import webpush from "web-push";
import { env } from "../config/env.js";

export function webPushConfigured() {
  return Boolean(env.WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY);
}

// Subscriptions are untrusted input: never allow an authenticated user to turn
// notification dispatch into requests to arbitrary hosts or internal services.
export function isPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash) return false;
    return url.hostname === "fcm.googleapis.com" ||
      url.hostname === "updates.push.services.mozilla.com" ||
      url.hostname.endsWith(".push.services.mozilla.com") ||
      url.hostname === "web.push.apple.com" ||
      url.hostname.endsWith(".notify.windows.com");
  } catch { return false; }
}

export async function sendWebPush(subscription: webpush.PushSubscription, payload: object) {
  if (!webPushConfigured()) throw new Error("web_push_not_configured");
  if (!isPushEndpoint(subscription.endpoint)) throw new Error("invalid_push_endpoint");
  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: 86400,
    timeout: 8000,
    vapidDetails: {
      subject: env.WEB_PUSH_SUBJECT,
      publicKey: env.WEB_PUSH_PUBLIC_KEY!,
      privateKey: env.WEB_PUSH_PRIVATE_KEY!
    }
  });
}
