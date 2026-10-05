import { devicesApi } from "@/lib/api";
import { getDeviceId } from "@/lib/device-id";
import { setPushStatus } from "@/lib/push-status";
import type { Language } from "@/types";

export async function configureDailyReminder(_enabled: boolean, _time: string, _language: Language) {
  return true; // Native scheduled reminders do not apply to browsers.
}

export async function syncPushNotifications(input: { accessToken: string; enabled: boolean; reminderTime: string; requestPermission?: boolean }) {
  if (!globalThis.isSecureContext || !("Notification" in globalThis) || !("serviceWorker" in navigator) || !("PushManager" in globalThis)) {
    setPushStatus("unsupported"); return false;
  }
  // Ask directly from a button gesture, never on page load or in a timer.
  const permission = input.enabled && input.requestPermission && Notification.permission === "default"
    ? await Notification.requestPermission() : Notification.permission;
  const deviceId = await getDeviceId();
  const preferences = { platform: "web" as const, notificationsEnabled: input.enabled, dailyReminderEnabled: false,
    reminderTime: input.reminderTime, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" };
  try {
    if (!input.enabled || permission !== "granted") {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
      await devicesApi.updatePreferences(deviceId, { ...preferences, notificationsEnabled: false, webPush: null }, input.accessToken);
      setPushStatus(!input.enabled ? "disabled" : permission === "denied" ? "denied" : "permission");
      return false;
    }
    const { publicKey } = await devicesApi.pushConfig(input.accessToken);
    if (!publicKey) { setPushStatus("setup_required"); return false; }
    await navigator.serviceWorker.register("/push-sw.js", { scope: "/", updateViaCache: "none" });
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("worker_timeout")), 12000))
    ]);
    const applicationServerKey = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), character => character.charCodeAt(0));
    let subscription = await registration.pushManager.getSubscription();
    // VAPID key rotation should not leave a permanently unusable subscription.
    if (subscription?.options.applicationServerKey &&
        String(new Uint8Array(subscription.options.applicationServerKey)) !== String(applicationServerKey)) {
      await subscription.unsubscribe(); subscription = null;
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("invalid_subscription");
    await devicesApi.updatePreferences(deviceId, { ...preferences, webPush: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } } }, input.accessToken);
    setPushStatus("ready"); return true;
  } catch { setPushStatus("error"); return false; }
}

export async function installNotificationHandlers(_onOpen: () => void, _onTokenChange: () => void) {
  return () => {};
}
