import { Platform } from "react-native";

import { devicesApi } from "@/lib/api";
import { getDeviceId } from "@/lib/device-id";
import type { Language } from "@/types";
import { setPushStatus } from "@/lib/push-status";
import { isExpoGo } from "@/lib/native-runtime";

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
  // Importing the package itself starts push-token registration in Android Expo Go.
  // Keep the entire module unloaded in the preview; APK behavior is unchanged.
  if (isExpoGo) return !enabled;

  const Notifications = await import("expo-notifications");
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!enabled) {
    return true;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily-reminders", {
      name: "Daily reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 100, 180],
      lightColor: "#0866FF",
    });
  }

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") return false;

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
 * Browser registration is implemented in notifications.web.ts.
 */
export async function syncPushNotifications(input: {
  accessToken: string;
  enabled: boolean;
  reminderTime: string;
  requestPermission?: boolean;
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

  if (input.enabled) {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("messages", { name: "Logic Coin", importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 180, 100, 180], lightColor: "#0866FF" });
      }
      let permission = await Notifications.getPermissionsAsync();
      if (permission.status !== "granted" && input.requestPermission) permission = await Notifications.requestPermissionsAsync();
      if (permission.status === "granted") {
        const Constants = (await import("expo-constants")).default;
        const projectId =
          Constants.easConfig?.projectId ??
          Constants.expoConfig?.extra?.eas?.projectId ??
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
        if (!projectId) { setPushStatus("setup_required"); }
        else {
          const response = await Notifications.getExpoPushTokenAsync({ projectId });
          pushToken = response.data || undefined;
          if (!pushToken) setPushStatus("error");
        }
      } else {
        pushToken = null;
        setPushStatus(permission.canAskAgain ? "permission" : "denied");
      }
    } catch {
      setPushStatus("error");
    }
  } else setPushStatus("disabled");

  await devicesApi.updatePreferences(
    deviceId,
    {
      platform: platformForDevice(),
      pushToken,
      notificationsEnabled: input.enabled && pushToken !== null,
      dailyReminderEnabled: input.enabled,
      reminderTime: input.reminderTime,
      timezone: currentTimeZone(),
    },
    input.accessToken,
  );

  if (pushToken) setPushStatus("ready");
  return Boolean(pushToken);
}

export async function installNotificationHandlers(onOpen: () => void, onTokenChange: () => void) {
  if (Platform.OS === "web" || isExpoGo) return () => {};
  const Notifications = await import("expo-notifications");
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
  const response = Notifications.addNotificationResponseReceivedListener(onOpen);
  const tokens = Notifications.addPushTokenListener(onTokenChange);
  if (await Notifications.getLastNotificationResponseAsync()) {
    onOpen(); await Notifications.clearLastNotificationResponseAsync();
  }
  return () => { response.remove(); tokens.remove(); };
}
