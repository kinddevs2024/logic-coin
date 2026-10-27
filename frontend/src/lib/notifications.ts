import { AppState, Linking, Platform } from "react-native";

import { devicesApi, inboxApi, type InboxNotification } from "@/lib/api";
import { getDeviceId } from "@/lib/device-id";
import type { Language } from "@/types";
import { getPushStatus, setPushStatus } from "@/lib/push-status";
import { isExpoGo } from "@/lib/native-runtime";
import { beforeReadCutoff, inboxNotificationCreatedAt, inboxNotificationIds, unseenInboxItems } from "./inbox-notification-tray";

let activeInboxAccount: string | undefined;
let localReadThrough: string | undefined;
const locallyReadIds = new Set<string>();
let permissionPrompt: ReturnType<typeof import("expo-notifications").requestPermissionsAsync> | undefined;

const contentByLanguage: Record<
  Language,
  { title: string; body: string }
> = {
  ru: {
    title: "Ваша копилка ждёт 💚",
    body: "Зайдите в Logic Coin, выполните активность и сохраните серию.",
  },
  uz: {
    title: "Jamg‘armangiz sizni kutmoqda 💚",
    body: "Logic Coin’ga kiring, vazifani bajaring va seriyani saqlang.",
  },
  en: {
    title: "Your savings bank is waiting 💚",
    body: "Open Logic Coin, complete an activity and protect your streak.",
  },
};

export async function configureDailyReminder(
  enabled: boolean,
  time: string,
  language: Language,
) {
  if (Platform.OS === "web") {
    return true;
  }
  // Importing the package itself starts push-token registration in Android Expo Go.
  // Keep the entire module unloaded in the preview; APK behavior is unchanged.
  if (isExpoGo) return !enabled;

  const Notifications = await import("expo-notifications");
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter(item => item.identifier === "logic-daily-reminder" ||
    item.content.data?.logicDailyReminder === true ||
    // Migrate the old anonymous daily reminder without cancelling inbox delivery.
    Object.values(contentByLanguage).some(content => content.body === item.content.body)
  ).map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)));

  if (!enabled) {
    return true;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily-reminders", {
      name: "Daily reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: "#007A57",
    });
  }

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") return false;

  const [hour, minute] = time.split(":").map(Number);
  await Notifications.scheduleNotificationAsync({
    identifier: "logic-daily-reminder",
    content: { ...contentByLanguage[language], data: { logicDailyReminder: true } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: Number.isFinite(hour) ? hour : 19,
      minute: Number.isFinite(minute) ? minute : 0,
      channelId: Platform.OS === "android" ? "daily-reminders" : undefined,
    },
  });
  return true;
}

function platformForDevice() {
  return Platform.OS === "android" ? "android" : Platform.OS === "ios" ? "ios" : "web";
}

function currentTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Keeps the server's Expo token in sync with the user's notification choice.
 * Browser registration is implemented in notifications.web.ts.
 */
export async function syncPushNotifications(input: {
  accessToken: string;
  enabled: boolean;
  reminderTime: string;
  requestPermission?: boolean;
  permissionOnEntry?: boolean;
}) {
  if (Platform.OS === "web") return false;
  if (isExpoGo) {
    setPushStatus("setup_required");
    return false;
  }

  const deviceId = await getDeviceId();
  const Notifications = await import("expo-notifications");
  // Undefined preserves an existing token on transient network/provider failure.
  let pushToken: string | null | undefined = input.enabled ? undefined : null;
  let fcmToken: string | null | undefined = input.enabled ? undefined : null;
  let fcmReady = false;
  let permitted = false;

  if (input.enabled) {
    try {
      let channelBlocked = false;
      if (Platform.OS === "android") {
        const channel = await Notifications.setNotificationChannelAsync("messages", { name: "Logic Coin", importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 180, 100, 180], lightColor: "#007A57" });
        channelBlocked = channel?.importance === Notifications.AndroidImportance.NONE;
      }
      let permission = await Notifications.getPermissionsAsync();
      if (permission.status === "undetermined" && input.requestPermission) {
        permissionPrompt ??= (async () => {
          if (input.permissionOnEntry) {
            const storage = (await import("@react-native-async-storage/async-storage")).default;
            const key = "logic-notification-entry-permission-requested-v1";
            if (await storage.getItem(key).catch(() => null)) return Notifications.getPermissionsAsync();
            await storage.setItem(key, "1").catch(() => {});
          }
          return Notifications.requestPermissionsAsync();
        })();
        try { permission = await permissionPrompt; } finally { permissionPrompt = undefined; }
      }
      if (permission.status === "granted" && !channelBlocked) {
        permitted = true;
        if (Platform.OS === "android") {
          try {
            const config = await devicesApi.pushConfig(input.accessToken);
            if (config.fcmEnabled) {
              const nativeToken = await Notifications.getDevicePushTokenAsync();
              if (nativeToken.type === "android" && typeof nativeToken.data === "string") {
                fcmToken = nativeToken.data;
                fcmReady = true;
                pushToken = null;
              }
            }
          } catch { /* Older APKs may lack native Firebase resources. */ }
        }
        const Constants = (await import("expo-constants")).default;
        const projectId =
          Constants.easConfig?.projectId ??
          Constants.expoConfig?.extra?.eas?.projectId ??
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
        if (fcmReady) { /* Direct FCM needs no EAS project. */ }
        else if (!projectId) { setPushStatus("local_only"); }
        else {
          const response = await Notifications.getExpoPushTokenAsync({ projectId });
          pushToken = response.data || undefined;
          if (!pushToken) setPushStatus("error");
        }
      } else {
        pushToken = null;
        fcmToken = null;
        setPushStatus(channelBlocked || permission.status === "denied" ? "denied" : "permission");
      }
    } catch {
      setPushStatus(permitted ? "local_only" : "error");
    }
  } else setPushStatus("disabled");

  try {
    await devicesApi.updatePreferences(
      deviceId,
      {
        platform: platformForDevice(),
        pushToken,
        fcmToken,
        notificationsEnabled: input.enabled && permitted,
        dailyReminderEnabled: input.enabled,
        reminderTime: input.reminderTime,
        timezone: currentTimeZone(),
      },
      input.accessToken,
    );
  } catch (error) {
    // A registration/network failure is not a revocation of OS permission.
    // Keep the permission prompt hidden and retry registration on resume.
    if (permitted) { setPushStatus("local_only"); return true; }
    throw error;
  }

  if (pushToken || fcmReady) setPushStatus("ready");
  return permitted;
}

export async function openNotificationSettings() {
  if (Platform.OS === "android") {
    try {
      const { applicationId } = await import("expo-application");
      if (applicationId) {
        await Linking.sendIntent("android.settings.APP_NOTIFICATION_SETTINGS", [
          { key: "android.provider.extra.APP_PACKAGE", value: applicationId },
        ]);
        return;
      }
    } catch { /* Older Android versions use the application's general settings. */ }
  }
  if (Platform.OS !== "web") await Linking.openSettings();
}

export async function dismissInboxNotifications(ids?: string[], before?: string) {
  if (Platform.OS === "web" || isExpoGo) return;
  ids?.forEach(id => locallyReadIds.add(id));
  if (!ids && before && (!localReadThrough || Date.parse(before) > Date.parse(localReadThrough))) localReadThrough = before;
  const Notifications = await import("expo-notifications");
  const selected = ids ? new Set(ids) : undefined;
  const matches = (data: Record<string, unknown> | undefined, receivedAt: number, identifier?: string) => {
    const inboxIds = inboxNotificationIds(data, identifier);
    return inboxIds.length > 0 && (!selected || inboxIds.some(id => selected.has(id))) &&
      beforeReadCutoff(inboxNotificationCreatedAt(data, identifier), receivedAt, before);
  };
  const [presented, scheduled] = await Promise.all([
    Notifications.getPresentedNotificationsAsync(), Notifications.getAllScheduledNotificationsAsync(),
  ]);
  await Promise.all([
    ...presented.filter(notification => matches(notification.request.content.data, notification.date, notification.request.identifier))
      .map(notification => Notifications.dismissNotificationAsync(notification.request.identifier)),
    ...scheduled.filter(notification => matches(notification.content.data, Infinity, notification.identifier))
      .map(notification => Notifications.cancelScheduledNotificationAsync(notification.identifier)),
  ]);
}

export async function installNotificationHandlers(onOpen: (ids: string[]) => void | Promise<void>, onTokenChange: () => void) {
  if (Platform.OS === "web" || isExpoGo) return () => {};
  const Notifications = await import("expo-notifications");
  Notifications.setNotificationHandler({ handleNotification: async notification => ({ shouldShowBanner: !notification.request.content.data?.silent, shouldShowList: true, shouldPlaySound: !notification.request.content.data?.silent, shouldSetBadge: false }) });
  const respond = async (response: Awaited<ReturnType<typeof Notifications.getLastNotificationResponseAsync>>) => {
    if (response) {
      await onOpen(inboxNotificationIds(response.notification.request.content.data, response.notification.request.identifier));
      await Notifications.clearLastNotificationResponseAsync();
    }
  };
  const response = Notifications.addNotificationResponseReceivedListener(value => { void respond(value).catch(() => {}); });
  // Android's getDevicePushTokenAsync also emits onDevicePushToken for the
  // current token. Re-registering on every emission recursively fetches it
  // again, flooding device endpoints and eventually throttling other screens.
  let lastDeviceToken: string | undefined;
  const tokens = Notifications.addPushTokenListener(token => {
    const identity = `${token.type}:${typeof token.data === "string" ? token.data : JSON.stringify(token.data)}`;
    if (identity === lastDeviceToken) return;
    lastDeviceToken = identity;
    onTokenChange();
  });
  const lastResponse = await Notifications.getLastNotificationResponseAsync();
  if (lastResponse) {
    void respond(lastResponse).catch(() => {});
  }
  return () => { response.remove(); tokens.remove(); };
}

/** An explicit local fallback, not remote push: runs only while the app is active. */
export async function startInboxNotificationSync(accessToken: string, accountId: string) {
  if (Platform.OS === "web" || isExpoGo) return () => {};
  if (activeInboxAccount !== accountId) {
    activeInboxAccount = accountId; localReadThrough = undefined; locallyReadIds.clear();
  }
  const Notifications = await import("expo-notifications");
  const storage = (await import("@react-native-async-storage/async-storage")).default;
  const key = `logic-inbox-tray-v1:${accountId}`;
  const stored = await storage.getItem(key).catch(() => null);
  let seen = new Set<string>();
  try { if (stored) seen = new Set(JSON.parse(stored) as string[]); } catch { /* Start with a silent catch-up. */ }
  let initial = !stored, stopped = false, busy = false;
  const tick = async () => {
    if (stopped || busy || AppState.currentState !== "active") return;
    busy = true;
    try {
      if ((await Notifications.getPermissionsAsync()).status !== "granted") return;
      const unread: InboxNotification[] = [];
      let cursor: { date: string; id: string } | null = null;
      do {
        const page = await inboxApi.list(accessToken, false, cursor);
        unread.push(...page.items); cursor = page.next;
      } while (cursor && unread.length < 200 && !stopped);
      if (stopped) return;
      const presented = await Notifications.getPresentedNotificationsAsync();
      const unreadIds = new Set(unread.map(item => item.id));
      const alreadyPresented = new Set(presented.flatMap(item => inboxNotificationIds(item.request.content.data, item.request.identifier)));
      if (!cursor) {
        const readIds = [...alreadyPresented].filter(id => !unreadIds.has(id));
        if (readIds.length) await dismissInboxNotifications(readIds);
      }
      if (getPushStatus() !== "local_only") return;
      if (Platform.OS === "android" && initial) await Notifications.setNotificationChannelAsync("inbox-history", {
        name: "Earlier messages", importance: Notifications.AndroidImportance.LOW, sound: null, enableVibrate: false,
      });
      for (const item of unseenInboxItems(unread, seen)) {
        if (stopped) break;
        if (locallyReadIds.has(item.id) || (localReadThrough && beforeReadCutoff(item.createdAt, Infinity, localReadThrough))) {
          seen.add(item.id); continue;
        }
        if (!alreadyPresented.has(item.id)) await Notifications.scheduleNotificationAsync({
          identifier: `logic-inbox-${item.id}`,
          content: {
            title: item.title, body: item.body, sound: initial ? undefined : "default",
            data: { inboxId: item.id, createdAt: item.createdAt, silent: initial },
          },
          trigger: Platform.OS === "android" ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: initial ? "inbox-history" : "messages" } : null,
        });
        seen.add(item.id);
      }
      seen = new Set([...seen].slice(-2000));
      await storage.setItem(key, JSON.stringify([...seen]));
      initial = false;
    } catch { /* Keep receipts uncommitted and retry after connection returns. */ }
    finally { busy = false; }
  };
  const timer = setInterval(() => { void tick(); }, 20_000);
  const active = AppState.addEventListener("change", state => { if (state === "active") void tick(); });
  void tick();
  return () => { stopped = true; clearInterval(timer); active.remove(); };
}
