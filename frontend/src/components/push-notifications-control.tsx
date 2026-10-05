import { useState, useSyncExternalStore } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { meApi } from "@/lib/api";
import { configureDailyReminder, syncPushNotifications } from "@/lib/notifications";
import { getPushStatus, subscribePushStatus, type PushStatus } from "@/lib/push-status";
import { useAppStore } from "@/store/app-store";

const labels = {
  ru: { enable: "Включить уведомления на устройстве", busy: "Подключение…", ready: "Уведомления на устройстве включены", denied: "Разреши уведомления для Logic Coin в настройках браузера или телефона.", unsupported: "Этот браузер не поддерживает push. Открой сайт в Chrome или Safari; на iPhone добавь сайт на экран Домой.", setup_required: "Push для этой версии приложения ещё не настроен.", error: "Не удалось подключить уведомления. Попробовать снова", permission: "Новые сообщения могут приходить, даже когда сайт закрыт.", disabled: "Уведомления на этом устройстве выключены.", idle: "Получай новые сообщения на устройство." },
  en: { enable: "Enable device notifications", busy: "Connecting…", ready: "Device notifications enabled", denied: "Allow Logic Coin notifications in your browser or phone settings.", unsupported: "Push is not supported here. Open Chrome or Safari; on iPhone add the site to your Home Screen.", setup_required: "Push is not configured for this app version yet.", error: "Could not connect notifications. Try again", permission: "Get new messages even when the site is closed.", disabled: "Device notifications are off.", idle: "Get new messages on your device." },
  uz: { enable: "Qurilma bildirishnomalarini yoqish", busy: "Ulanmoqda…", ready: "Bildirishnomalar yoqilgan", denied: "Brauzer yoki telefon sozlamalarida Logic Coin bildirishnomalariga ruxsat bering.", unsupported: "Bu brauzer push-ni qo‘llamaydi. Chrome yoki Safari’da oching; iPhone’da bosh ekranga qo‘shing.", setup_required: "Ushbu ilova versiyasi uchun push hali sozlanmagan.", error: "Ulanib bo‘lmadi. Qayta urinib ko‘ring", permission: "Sayt yopiq bo‘lsa ham yangi xabarlarni oling.", disabled: "Qurilma bildirishnomalari o‘chirilgan.", idle: "Yangi xabarlarni qurilmangizda oling." }
};

export function PushNotificationsControl() {
  const token = useAppStore(s => s.accessToken);
  const time = useAppStore(s => s.notificationTime);
  const { language } = useTranslation();
  const theme = useAppTheme();
  const status: PushStatus = useSyncExternalStore(subscribePushStatus, getPushStatus, () => "idle");
  const [busy, setBusy] = useState(false);
  if (!token) return null;
  const c = labels[language];
  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ready = await syncPushNotifications({ accessToken: token, enabled: true, reminderTime: time, requestPermission: true });
      if (ready) {
        useAppStore.getState().setNotifications(true);
        await Promise.all([
          meApi.updatePreferences({ notificationsEnabled: true, dailyReminderEnabled: true }, token),
          configureDailyReminder(true, time, language)
        ]);
      }
    } finally { setBusy(false); }
  };
  return <View style={{ padding: 12, gap: 8 }}>
    <AppText variant="caption" muted accessibilityLiveRegion="polite">{c[status]}</AppText>
    {status !== "ready" && status !== "unsupported" && status !== "denied" && status !== "setup_required" ?
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void enable().catch(() => {}); }} style={{ padding: 12, borderRadius: 14, backgroundColor: theme.primary }}>
        <AppText color="#FFFFFF" variant="label">{busy ? c.busy : c.enable}</AppText>
      </Pressable> : null}
  </View>;
}
