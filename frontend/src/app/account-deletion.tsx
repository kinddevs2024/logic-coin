import { useRouter } from "expo-router";
import { Linking, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenHeader } from "@/components/screen-header";
import { radii } from "@/constants/theme";
import { useTranslation } from "@/hooks/use-translation";

const supportEmail = "kinddevs2024@gmail.com";

const copy = {
  ru: {
    title: "Удаление аккаунта",
    intro:
      "Чтобы удалить аккаунт Logic Coin и связанные данные, отправьте запрос с email, который используется в аккаунте.",
    steps: [
      "Нажмите кнопку ниже и отправьте подготовленное письмо.",
      "Для защиты аккаунта мы можем попросить подтвердить адрес email.",
      "После подтверждения аккаунт и связанные данные будут удалены, кроме данных, которые нужно временно сохранить по требованиям закона или безопасности.",
    ],
    button: "Отправить запрос",
    note: "Обычно запрос обрабатывается в течение 30 календарных дней.",
  },
  uz: {
    title: "Hisobni o‘chirish",
    intro:
      "Logic Coin hisobingiz va unga bog‘liq ma’lumotlarni o‘chirish uchun hisobda ishlatilgan email manzilidan so‘rov yuboring.",
    steps: [
      "Quyidagi tugmani bosing va tayyor xatni yuboring.",
      "Hisobni himoya qilish uchun email manzilini tasdiqlashni so‘rashimiz mumkin.",
      "Tasdiqlangandan so‘ng hisob va bog‘liq ma’lumotlar o‘chiriladi, qonun yoki xavfsizlik talab qiladigan vaqtinchalik ma’lumotlar bundan mustasno.",
    ],
    button: "So‘rov yuborish",
    note: "So‘rov odatda 30 kalendar kun ichida ko‘rib chiqiladi.",
  },
  en: {
    title: "Account deletion",
    intro:
      "To delete your Logic Coin account and associated data, send a request from the email address used for the account.",
    steps: [
      "Use the button below to send the prepared request.",
      "We may ask you to verify the email address to protect the account.",
      "After verification, the account and associated data will be deleted except data that must be retained temporarily for legal or security reasons.",
    ],
    button: "Send deletion request",
    note: "Requests are normally processed within 30 calendar days.",
  },
} as const;

export default function AccountDeletionScreen() {
  const router = useRouter();
  const { language } = useTranslation();
  const c = copy[language];
  const mailto = `mailto:${supportEmail}?subject=Logic%20Coin%20account%20deletion&body=Please%20delete%20my%20Logic%20Coin%20account%20and%20associated%20data.%0A%0AAccount%20email%3A%20`;

  return (
    <AppFrame wide>
      <ScreenHeader title={c.title} onBack={() => router.back()} />
      <GlassSurface intensity={64} variant="strong" style={styles.card}>
        <AppText>{c.intro}</AppText>
        <View style={styles.steps}>
          {c.steps.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={styles.number}>
                <AppText variant="caption" color="#FFFFFF">
                  {index + 1}
                </AppText>
              </View>
              <AppText muted style={styles.stepText}>
                {step}
              </AppText>
            </View>
          ))}
        </View>
        <AppButton
          icon="mail-outline"
          glow
          onPress={() => void Linking.openURL(mailto)}
        >
          {c.button}
        </AppButton>
        <AppText variant="caption" muted>
          {c.note}
        </AppText>
      </GlassSurface>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: 20,
    gap: 18,
  },
  steps: {
    gap: 14,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A84FF",
  },
  stepText: {
    flex: 1,
  },
});
