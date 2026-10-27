import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
const copy = {
  "uz": {
    "title": "🗓 OYLIK FAOLLIK",
    "close": "Yopish",
    "paragraphs": [
      "Bu raqam shu oyda chempionatni necha kun to‘liq yakunlaganingizni ko‘rsatadi. Masalan, 8/31 — oyning 31 kunidan 8 kun bajarilgan.",
      "✅ Kun hisoblanishi uchun chempionatdagi 6 ta o‘yinning barchasini yakunlang.",
      "Oy davomida bir kun ham qoldirmasangiz, oylik pul sovrinlari tanlovida ham qatnashasiz!",
      "🎁 Sovrinlar:\n1-sovrin — 75 $\n2-sovrin — 30 $\n3-sovrin — 10 $\nQolgan pul sovrinlari — 1 $ gacha.",
      "🎲 G‘oliblar oyning barcha kunlarini bajarganlar orasidan tasodifiy tanlanadi. Ballar hisobga olinmaydi — kam ball bilan ham yutishingiz mumkin! Sovrin hammaga berilmaydi.",
      "🔄 Tanlov har oy o‘tkaziladi."
    ]
  },
  "ru": {
    "title": "🗓 МЕСЯЧНАЯ АКТИВНОСТЬ",
    "close": "Закрыть",
    "paragraphs": [
      "Это число показывает, сколько дней в этом месяце вы полностью завершили чемпионат. Например, 8/31 — выполнены 8 из 31 дня месяца.",
      "✅ Чтобы день засчитался, завершите все 6 игр чемпионата.",
      "Не пропустите ни одного дня месяца, чтобы участвовать также в розыгрыше ежемесячных денежных призов!",
      "🎁 Призы:\n1-й приз — 75 $\n2-й приз — 30 $\n3-й приз — 10 $\nОстальные денежные призы — до 1 $.",
      "🎲 Победителей выбирают случайным образом среди завершивших все дни месяца. Баллы не учитываются — выиграть можно и с небольшим количеством баллов! Призы получают не все.",
      "🔄 Розыгрыш проводится каждый месяц."
    ]
  },
  "en": {
    "title": "🗓 MONTHLY ACTIVITY",
    "close": "Close",
    "paragraphs": [
      "This number shows how many days you fully completed the championship this month. For example, 8/31 means 8 of the month’s 31 days completed.",
      "✅ Complete all 6 championship games for a day to count.",
      "Complete every day of the month without missing one to enter the monthly cash prize draw as well!",
      "🎁 Prizes:\n1st prize — $75\n2nd prize — $30\n3rd prize — $10\nOther cash prizes — up to $1.",
      "🎲 Winners are selected randomly among those who completed every day of the month. Scores do not count — you can win even with a low score! Not everyone receives a prize.",
      "🔄 The draw takes place every month."
    ]
  }
};
const weeklyCopy = {
  "uz": {
    "title": "📅 HAFTALIK FAOLLIK",
    "close": "Yopish",
    "paragraphs": [
      "Bu raqam shu haftada chempionatni necha kun to‘liq yakunlaganingizni ko‘rsatadi. Masalan, 4/7 — 7 kundan 4 kun bajarilgan.",
      "✅ Kun hisoblanishi uchun chempionatdagi 6 ta o‘yinning barchasini yakunlang.",
      "Hafta davomida bir kun ham qoldirmasangiz, haftalik pul sovrinlari tanlovida qatnashasiz!",
      "🎁 Sovrinlar:\n1-sovrin — 30 $\n2-sovrin — 15 $\n3-sovrin — 5 $\nQolgan pul sovrinlari — 0,50 $ gacha.",
      "🎲 G‘oliblar barcha 7 kunni bajarganlar orasidan tasodifiy tanlanadi. Ballar hisobga olinmaydi — kam ball bilan ham yutishingiz mumkin! Sovrin hammaga berilmaydi.",
      "🔄 Tanlov har hafta o‘tkaziladi."
    ]
  },
  "ru": {
    "title": "📅 НЕДЕЛЬНАЯ АКТИВНОСТЬ",
    "close": "Закрыть",
    "paragraphs": [
      "Это число показывает, сколько дней на этой неделе вы полностью завершили чемпионат. Например, 4/7 — выполнены 4 из 7 дней.",
      "✅ Чтобы день засчитался, завершите все 6 игр чемпионата.",
      "Не пропустите ни одного дня недели, чтобы участвовать в розыгрыше еженедельных денежных призов!",
      "🎁 Призы:\n1-й приз — 30 $\n2-й приз — 15 $\n3-й приз — 5 $\nОстальные денежные призы — до 0,50 $.",
      "🎲 Победителей выбирают случайным образом среди завершивших все 7 дней. Баллы не учитываются — выиграть можно и с небольшим количеством баллов! Призы получают не все.",
      "🔄 Розыгрыш проводится каждую неделю."
    ]
  },
  "en": {
    "title": "📅 WEEKLY ACTIVITY",
    "close": "Close",
    "paragraphs": [
      "This number shows how many days you fully completed the championship this week. For example, 4/7 means 4 of 7 days completed.",
      "✅ Complete all 6 championship games for a day to count.",
      "Complete every day of the week without missing one to enter the weekly cash prize draw!",
      "🎁 Prizes:\n1st prize — $30\n2nd prize — $15\n3rd prize — $5\nOther cash prizes — up to $0.50.",
      "🎲 Winners are selected randomly among those who completed all 7 days. Scores do not count — you can win even with a low score! Not everyone receives a prize.",
      "🔄 The draw takes place every week."
    ]
  }
};
export function MonthlyActivityInfo({ onClose, period = "month" }: { onClose: () => void; period?: "week" | "month" }) {
  const theme = useAppTheme();
  const { language } = useTranslation();
  const c = (period === "week" ? weeklyCopy : copy)[language];
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}><Pressable accessibilityRole="button" accessibilityLabel={c.close} style={StyleSheet.absoluteFill} onPress={onClose} />
      <GlassSurface variant="strong" style={styles.card}><AppText variant="heading" accessibilityRole="header">{c.title}</AppText>
        <ScrollView contentContainerStyle={styles.paragraphs}>{c.paragraphs.map((text, index) => <AppText key={index}>{text}</AppText>)}</ScrollView>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}><AppText variant="label" color={String(theme.primary)}>{c.close}</AppText></Pressable>
      </GlassSurface>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }, card: { maxHeight: "80%", maxWidth: 480, alignSelf: "center", padding: 22, borderRadius: 26, gap: 16 }, paragraphs: { gap: 14 }, close: { minHeight: 44, justifyContent: "center", alignItems: "center" } });
