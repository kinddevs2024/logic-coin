import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "@/hooks/use-translation";
import { challengesApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";

const copy = {
  ru: { daily: "Дневные подарки", weekly: "Недельные подарки", monthly: "Месячные подарки", dailyRule: "Заверши все 6 игр. Денежные призы зависят от места в рейтинге.", preliminary: "Предварительные суммы: зависят от участников и настроек организатора.", final: "Окончательные призы за этот день.", place: "место", unset: "Сумма пока не назначена", missing: "Призы дня пока не объявлены", retry: "Повторить", error: "Не удалось загрузить призы", weekRule: "Для розыгрыша по условиям организатора заверши все 6 игр ежедневно, без пропусков, в течение недели.", monthRule: "Для розыгрыша по условиям организатора заверши все 6 игр ежедневно, без пропусков, в течение месяца.", pending: "Денежный розыгрыш пока не подключён. Суммы и даты объявляет организатор; этот счётчик не выдаёт приз автоматически.", chance: "Победителей выбирают случайно среди выполнивших условия. Коины не влияют на выбор; приз не гарантирован.", progress: "Завершено дней", period: "Неделя начинается в понедельник; месяц — с 1-го числа." },
  en: { daily: "Daily rewards", weekly: "Weekly rewards", monthly: "Monthly rewards", dailyRule: "Finish all 6 games. Cash prizes depend on your leaderboard rank.", preliminary: "Provisional amounts depend on participants and organizer settings.", final: "Final prizes for this day.", place: "place", unset: "Amount not assigned yet", missing: "Daily prizes have not been announced", retry: "Retry", error: "Could not load prizes", weekRule: "For a draw under the organizer’s rules, finish all 6 games every day of the week without skipping a day.", monthRule: "For a draw under the organizer’s rules, finish all 6 games every day of the month without skipping a day.", pending: "The cash draw is not connected yet. The organizer announces amounts and dates; this counter does not award a prize automatically.", chance: "Winners are selected randomly among eligible participants. Coins do not affect selection; a prize is not guaranteed.", progress: "Completed days", period: "Weeks start on Monday; months start on the 1st." },
  uz: { daily: "Kunlik sovg‘alar", weekly: "Haftalik sovg‘alar", monthly: "Oylik sovg‘alar", dailyRule: "Barcha 6 ta o‘yinni yakunlang. Pul sovrinlari reytingdagi o‘ringa bog‘liq.", preliminary: "Dastlabki summalar ishtirokchilar va tashkilotchi sozlamalariga bog‘liq.", final: "Shu kunning yakuniy sovrinlari.", place: "o‘rin", unset: "Summa hali belgilanmagan", missing: "Kunlik sovrinlar hali e’lon qilinmagan", retry: "Qayta urinish", error: "Sovrinlarni yuklab bo‘lmadi", weekRule: "Tashkilotchi shartlari bo‘yicha tanlov uchun haftaning har kuni barcha 6 ta o‘yinni bir kun ham qoldirmasdan yakunlang.", monthRule: "Tashkilotchi shartlari bo‘yicha tanlov uchun oyning har kuni barcha 6 ta o‘yinni bir kun ham qoldirmasdan yakunlang.", pending: "Pul tanlovi hali ulanmagan. Summalar va sanalarni tashkilotchi e’lon qiladi; bu hisoblagich avtomatik sovrin bermaydi.", chance: "G‘oliblar shartlarni bajarganlar orasidan tasodifiy tanlanadi. Coinlar ta’sir qilmaydi; sovrin kafolatlanmaydi.", progress: "Yakunlangan kunlar", period: "Hafta dushanbadan, oy esa 1-sanadan boshlanadi." },
};

export function ChallengeRewardOverview({ token }: { token: string }) {
  const { language } = useTranslation();
  const c = copy[language];
  const prizes = useQuery({ queryKey: ["challenge-prize-rules", token], queryFn: () => challengesApi.rules(token), staleTime: 0, retry: 1 });
  const activity = useQuery({ queryKey: ["challenge-reward-activity", token], queryFn: () => challengesApi.today(token), staleTime: 0, retry: 1 });
  return <View style={styles.list}>
    <View style={styles.card}>
      <View style={styles.heading}><Ionicons name="trophy-outline" size={22} color="#D8D1FF" /><Text style={styles.title}>{c.daily}</Text></View>
      <Text style={styles.body}>{c.dailyRule}</Text>
      {prizes.isPending ? <ActivityIndicator color="#A89AFF" /> : prizes.isError ? <Pressable accessibilityRole="button" onPress={() => void prizes.refetch()}><Text style={styles.body}>{c.error} · {c.retry}</Text></Pressable> : <>
        <Text style={styles.body}>{prizes.data.final ? c.final : c.preliminary}</Text>
        {prizes.data.cashWinnerCount > 0 ? prizes.data.podium.map(prize => <View key={prize.rank} style={styles.row}><Text style={styles.body}>{prize.rank} {c.place}</Text><Text style={styles.amount}>{prize.cashUnits === null ? c.unset : formatMoney(prize.cashUnits)}</Text></View>) : <Text style={styles.body}>{c.missing}</Text>}
      </>}
    </View>
    {(["week", "month"] as const).map(period => <View key={period} style={styles.card}>
      <View style={styles.heading}><Ionicons name="calendar-outline" size={22} color="#D8D1FF" /><Text style={styles.title}>{period === "week" ? c.weekly : c.monthly}</Text></View>
      <Text style={styles.amount}>{c.progress}: {activity.data ? period === "week" ? `${activity.data.weeklyCompletedDays ?? 0}/7` : `${activity.data.monthlyCompletedDays ?? 0}/${activity.data.monthlyDaysInMonth}` : "—"}</Text>
      {activity.isError ? <Pressable accessibilityRole="button" onPress={() => void activity.refetch()}><Text style={styles.body}>{c.retry}</Text></Pressable> : null}
      <Text style={styles.body}>{period === "week" ? c.weekRule : c.monthRule}</Text>
      <Text style={styles.body}>{c.chance}</Text>
      <Text style={styles.notice}>{c.pending}</Text>
      <Text style={styles.body}>{c.period}</Text>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  list: { gap: 12 }, card: { padding: 16, gap: 10, borderRadius: 20, backgroundColor: "rgba(124,92,255,0.12)", borderWidth: 1, borderColor: "rgba(168,154,255,0.24)" },
  heading: { flexDirection: "row", alignItems: "center", gap: 10 }, title: { color: "#FFFFFF", fontSize: 17, fontWeight: "800", flexShrink: 1 }, body: { color: "#D2D3E0", fontSize: 13, lineHeight: 19 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, amount: { color: "#D8D1FF", fontSize: 14, fontWeight: "700", flexShrink: 1 }, notice: { color: "#FFDE9A", fontSize: 12, lineHeight: 18 },
});
