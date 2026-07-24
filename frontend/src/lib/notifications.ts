import { Platform } from "react-native";

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
