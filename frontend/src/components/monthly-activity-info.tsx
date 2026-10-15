import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
const copy = {
  ru: { title: "Месячная активность", close: "Закрыть", paragraphs: [
    "Показатель отражает, сколько дней в текущем месяце ты полностью завершил челлендж. Например, 8/31 означает: завершены 8 из 31 календарного дня.",
    "Чтобы день засчитался, заверши все шесть игр его челленджа. Начатые игры, обычный режим и повтор одной игры не заменяют прохождение всего набора.",
    "Если организатор объявляет месячный розыгрыш с этими условиями, для участия нужно завершать все шесть игр ежедневно, без пропусков. Победителей выбирают случайным образом среди выполнивших условия; количество коинов на выбор не влияет. Участие не гарантирует приз.",
    "Суммы призов и сроки месячного розыгрыша организатор объявляет отдельно. Этот счётчик сам по себе не начисляет денежный приз. Актуальные дневные призы можно посмотреть в правилах соответствующего челленджа.",
  ] },
  en: { title: "Monthly activity", close: "Close", paragraphs: [
    "This counter shows how many days you fully completed the challenge this month. For example, 8/31 means 8 of the month's 31 calendar days are complete.",
    "A day counts only after all six games in that day's challenge are completed. Started games, practice mode and repeating one game do not complete the whole set.",
    "If the organizer announces a monthly draw under these rules, participation requires completing all six games every day without skipping a day. Winners are selected randomly among eligible participants; coins do not affect the selection. Participation does not guarantee a prize.",
    "Monthly prize amounts and draw dates are announced separately by the organizer. This counter does not itself award a cash prize. Current daily prizes appear in the corresponding challenge's rules.",
  ] },
  uz: { title: "Oylik faollik", close: "Yopish", paragraphs: [
    "Bu ko‘rsatkich shu oyda chempionatni necha kun to‘liq yakunlaganingizni bildiradi. Masalan, 8/31 — oyning 31 kalendar kunidan 8 kuni to‘liq bajarilgan.",
    "Kun hisoblanishi uchun shu kunning chempionatidagi oltita o‘yinning barchasini yakunlang. Boshlangan o‘yinlar, oddiy o‘yin rejimi yoki bitta o‘yinni takrorlash barcha o‘yinlarni bajarish o‘rnini bosmaydi.",
    "Tashkilotchi shu shartlar bilan oylik tanlov e’lon qilsa, qatnashish uchun har kuni oltita o‘yinni bir kun ham qoldirmasdan yakunlash kerak. G‘oliblar shartlarni bajarganlar orasidan tasodifiy tanlanadi; coinlar soni bunga ta’sir qilmaydi. Ishtirok sovrin olishni kafolatlamaydi.",
    "Oylik sovrin summalari va tanlov sanalarini tashkilotchi alohida e’lon qiladi. Bu hisoblagich o‘z-o‘zidan pul sovrini bermaydi. Joriy kunlik sovrinlarni tegishli chempionat qoidalaridan ko‘rishingiz mumkin.",
  ] },
};
const weeklyCopy = {
  ru: { title: "Недельная активность", close: "Закрыть", paragraphs: [
    "Показатель отражает, сколько дней этой календарной недели ты полностью завершил челлендж. Например, 4/7 означает: завершены четыре из семи дней. Неделя начинается в понедельник.",
    "День засчитывается после завершения всех шести игр его челленджа. Начатые игры, обычный режим и повтор одной игры не заменяют прохождение всего набора.",
    "Если организатор объявляет недельный розыгрыш с этими условиями, для участия нужно завершить все шесть игр в каждый из семи дней недели, без пропусков. Победителей выбирают случайным образом среди выполнивших условия; количество коинов на выбор не влияет. Участие не гарантирует приз.",
    "Суммы призов и сроки недельного розыгрыша организатор объявляет отдельно. Этот счётчик сам по себе не начисляет денежный приз. Дневные призы указаны в правилах соответствующего челленджа.",
  ] },
  en: { title: "Weekly activity", close: "Close", paragraphs: [
    "This counter shows how many days you fully completed the challenge during this calendar week. For example, 4/7 means four of seven days are complete. The week starts on Monday.",
    "A day counts only after all six games in that day's challenge are completed. Started games, practice mode and repeating one game do not complete the whole set.",
    "If the organizer announces a weekly draw under these rules, participation requires completing all six games on every one of the week's seven days, without skipping a day. Winners are selected randomly among eligible participants; coins do not affect selection. Participation does not guarantee a prize.",
    "Weekly prize amounts and draw dates are announced separately by the organizer. This counter does not itself award a cash prize. Daily prizes appear in the corresponding challenge's rules.",
  ] },
  uz: { title: "Haftalik faollik", close: "Yopish", paragraphs: [
    "Bu ko‘rsatkich shu kalendar haftada chempionatni necha kun to‘liq yakunlaganingizni bildiradi. Masalan, 4/7 — yetti kundan to‘rt kuni bajarilgan. Hafta dushanbadan boshlanadi.",
    "Kun hisoblanishi uchun shu kunning chempionatidagi oltita o‘yinning barchasini yakunlang. Boshlangan o‘yinlar, oddiy rejim yoki bitta o‘yinni takrorlash barcha o‘yinlarni bajarish o‘rnini bosmaydi.",
    "Tashkilotchi shu shartlar bilan haftalik tanlov e’lon qilsa, qatnashish uchun haftaning barcha yetti kunida oltita o‘yinni bir kun ham qoldirmasdan yakunlash kerak. G‘oliblar shartlarni bajarganlar orasidan tasodifiy tanlanadi; coinlar soni bunga ta’sir qilmaydi. Ishtirok sovrin olishni kafolatlamaydi.",
    "Haftalik sovrin summalari va tanlov sanalarini tashkilotchi alohida e’lon qiladi. Bu hisoblagich o‘z-o‘zidan pul sovrini bermaydi. Kunlik sovrinlar tegishli chempionat qoidalarida ko‘rsatiladi.",
  ] },
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
