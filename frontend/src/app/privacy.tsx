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
    title: "Конфиденциальность",
    updated: "Редакция от 5 августа 2026 года",
    intro:
      "Logic Coin и разработчик KindDevs уважают вашу конфиденциальность. Ниже описано, какие данные обрабатываются и для чего.",
    sections: [
      {
        title: "Какие данные мы обрабатываем",
        body:
          "Данные аккаунта: имя, email, аватар и идентификатор выбранного способа входа Google, Яндекс или Telegram. Данные приложения: баланс LC, задания, бонусы, активность, приглашения, настройки и заявки на вывод. Технические данные: тип устройства, push-токен, IP-адрес, журналы ошибок и обезличенная аналитика использования.",
      },
      {
        title: "Зачем нужны данные",
        body:
          "Для регистрации и входа, синхронизации прогресса, начисления наград, обработки заявок, отправки выбранных уведомлений, защиты от злоупотреблений, поддержки пользователей и улучшения стабильности приложения.",
      },
      {
        title: "Сервисы и передача данных",
        body:
          "Для работы Logic Coin могут использоваться Google, Яндекс и Telegram для входа, MongoDB Atlas для хранения, Vercel для хостинга и аналитики, Umami для аналитики, Gmail/SMTP для кодов подтверждения и Expo или системные службы устройства для уведомлений. Мы не продаём персональные данные.",
      },
      {
        title: "Хранение и защита",
        body:
          "Данные хранятся только столько, сколько нужно для работы сервиса, выполнения законных обязательств и предотвращения мошенничества. Передача данных защищается HTTPS. Доступ к рабочим системам ограничен.",
      },
      {
        title: "Ваши права",
        body:
          "Вы можете запросить доступ, исправление или удаление данных. После запроса аккаунт и связанные данные удаляются, кроме информации, которую необходимо временно сохранить по требованиям закона, безопасности или предотвращения мошенничества.",
      },
      {
        title: "Дети",
        body:
          "Logic Coin не предназначен для детей младше 13 лет. Если вы считаете, что ребёнок передал нам данные без согласия, свяжитесь с нами.",
      },
    ],
    deleteAccount: "Удаление аккаунта",
    contact: "Связаться с поддержкой",
  },
  uz: {
    title: "Maxfiylik siyosati",
    updated: "2026-yil 5-avgustdagi tahrir",
    intro:
      "Logic Coin va KindDevs maxfiyligingizni hurmat qiladi. Quyida qanday ma’lumotlar qayta ishlanishi va nima uchun ishlatilishi bayon qilingan.",
    sections: [
      {
        title: "Qanday ma’lumotlarni qayta ishlaymiz",
        body:
          "Hisob ma’lumotlari: ism, email, avatar va Google, Yandex yoki Telegram kirish identifikatori. Ilova ma’lumotlari: LC balansi, vazifalar, bonuslar, faollik, takliflar, sozlamalar va yechib olish so‘rovlari. Texnik ma’lumotlar: qurilma turi, push-token, IP manzil, xato jurnallari va anonim foydalanish tahlili.",
      },
      {
        title: "Ma’lumotlardan foydalanish",
        body:
          "Ro‘yxatdan o‘tish va kirish, natijani sinxronlash, mukofotlarni hisoblash, so‘rovlarni ko‘rib chiqish, tanlangan bildirishnomalarni yuborish, suiiste’molning oldini olish va ilova barqarorligini yaxshilash uchun.",
      },
      {
        title: "Xizmatlar va uzatish",
        body:
          "Logic Coin Google, Yandex va Telegram kirish xizmatlaridan, MongoDB Atlas saqlash xizmatidan, Vercel hosting va tahlilidan, Umami tahlilidan, tasdiqlash kodlari uchun Gmail/SMTP xizmatidan hamda bildirishnomalar uchun Expo yoki qurilma xizmatlaridan foydalanishi mumkin. Shaxsiy ma’lumotlarni sotmaymiz.",
      },
      {
        title: "Saqlash va himoya",
        body:
          "Ma’lumotlar xizmat ishlashi, qonuniy majburiyatlar va firibgarlikning oldini olish uchun zarur muddatgacha saqlanadi. Ma’lumotlar HTTPS orqali uzatiladi va ishchi tizimlarga kirish cheklangan.",
      },
      {
        title: "Sizning huquqlaringiz",
        body:
          "Ma’lumotlarga kirish, ularni tuzatish yoki o‘chirishni so‘rashingiz mumkin. So‘rovdan keyin hisob va unga bog‘liq ma’lumotlar o‘chiriladi, qonun, xavfsizlik yoki firibgarlikning oldini olish uchun vaqtincha saqlanishi kerak bo‘lgan ma’lumotlar bundan mustasno.",
      },
      {
        title: "Bolalar",
        body:
          "Logic Coin 13 yoshgacha bo‘lgan bolalar uchun mo‘ljallanmagan. Bola roziliksiz ma’lumot yuborgan deb hisoblasangiz, biz bilan bog‘laning.",
      },
    ],
    deleteAccount: "Hisobni o‘chirish",
    contact: "Yordam bilan bog‘lanish",
  },
  en: {
    title: "Privacy Policy",
    updated: "Effective August 5, 2026",
    intro:
      "Logic Coin and its developer, KindDevs, respect your privacy. This policy explains what data is processed and why.",
    sections: [
      {
        title: "Data we process",
        body:
          "Account data: name, email, avatar, and the identifier from Google, Yandex, or Telegram sign-in. App data: LC balance, tasks, bonuses, activity, referrals, preferences, and withdrawal requests. Technical data: device type, push token, IP address, error logs, and de-identified usage analytics.",
      },
      {
        title: "How we use data",
        body:
          "To create and secure accounts, synchronize progress, credit rewards, process requests, deliver notifications you choose, prevent abuse, provide support, and improve app reliability.",
      },
      {
        title: "Services and sharing",
        body:
          "Logic Coin may use Google, Yandex, and Telegram for sign-in; MongoDB Atlas for storage; Vercel for hosting and analytics; Umami for analytics; Gmail/SMTP for verification codes; and Expo or device services for notifications. We do not sell personal data.",
      },
      {
        title: "Retention and security",
        body:
          "Data is retained only as needed to operate the service, meet legal obligations, and prevent fraud. Data is transferred over HTTPS and access to production systems is restricted.",
      },
      {
        title: "Your choices",
        body:
          "You may request access, correction, or deletion. After a deletion request, the account and associated data are removed except data that must be retained temporarily for legal, security, or fraud-prevention reasons.",
      },
      {
        title: "Children",
        body:
          "Logic Coin is not intended for children under 13. Contact us if you believe a child submitted data without appropriate consent.",
      },
    ],
    deleteAccount: "Delete account",
    contact: "Contact support",
  },
} as const;

export default function PrivacyScreen() {
  const router = useRouter();
  const { language } = useTranslation();
  const c = copy[language];

  return (
    <AppFrame wide>
      <ScreenHeader title={c.title} onBack={() => router.back()} />
      <GlassSurface intensity={64} variant="strong" style={styles.card}>
        <AppText variant="caption" muted>
          {c.updated}
        </AppText>
        <AppText>{c.intro}</AppText>
        {c.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <AppText variant="heading">{section.title}</AppText>
            <AppText muted>{section.body}</AppText>
          </View>
        ))}
        <View style={styles.actions}>
          <AppButton
            icon="trash-outline"
            variant="secondary"
            onPress={() => router.push("/account-deletion" as never)}
          >
            {c.deleteAccount}
          </AppButton>
          <AppButton
            icon="mail-outline"
            variant="ghost"
            onPress={() =>
              void Linking.openURL(`mailto:${supportEmail}?subject=Logic%20Coin%20privacy`)
            }
          >
            {c.contact}
          </AppButton>
        </View>
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
  section: {
    gap: 6,
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
});
