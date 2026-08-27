import { Platform } from "react-native";

import { devicesApi } from "@/lib/api";
import { getDeviceId } from "@/lib/device-id";
import type { Language } from "@/types";

const contentByLanguage: Record<
  Language,
  { title: string; body: string }
> = {
  ru: {
    title: "Ваша копилка ждёт 💙",
    body: "Зайдите в Logic Coin, выполните активность и сохраните серию.",
  },
  uz: {
    title: "Jamg‘armangiz sizni kutmoqda 💙",
    body: "Logic Coin’ga kiring, vazifani bajaring va seriyani saqlang.",
  },
  en: {
    title: "Your savings bank is waiting 💙",
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

  const Notifications = await import("expo-notifications");
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!enabled) {
    return true;
  }

  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") {
    return false;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily-reminders", {
      name: "Daily reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: "#0866FF",
    });
  }

  const [hour, minute] = time.split(":").map(Number);
  await Notifications.scheduleNotificationAsync({
    content: contentByLanguage[language],
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
 * Web keeps its own service-worker path; only native devices receive Expo push.
 */
export async function syncPushNotifications(input: {
  accessToken: string;
  enabled: boolean;
  reminderTime: string;
}) {
  if (Platform.OS === "web") return false;

  const deviceId = await getDeviceId();
  const Notifications = await import("expo-notifications");
  let pushToken: string | null = null;

  if (input.enabled) {
    try {
      const permission = await Notifications.getPermissionsAsync();
      if (permission.status === "granted") {
        const Constants = (await import("expo-constants")).default;
        const projectId =
          Constants.easConfig?.projectId ??
          Constants.expoConfig?.extra?.eas?.projectId ??
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
        const response = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        pushToken = response.data || null;
      }
    } catch {
      // A token is not available in simulators and unconfigured development builds.
      // The server still receives `null`, preventing delivery to a stale device token.
      pushToken = null;
    }
  }

  await devicesApi.updatePreferences(
    deviceId,
    {
      platform: platformForDevice(),
      pushToken,
      notificationsEnabled: input.enabled && Boolean(pushToken),
      dailyReminderEnabled: input.enabled,
      reminderTime: input.reminderTime,
      timezone: currentTimeZone(),
    },
    input.accessToken,
  );

  return Boolean(pushToken);
}
