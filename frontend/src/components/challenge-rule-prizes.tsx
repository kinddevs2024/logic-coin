import { useUiCopy } from "@/components/localized-native";

import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { challengesApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useAppStore } from "@/store/app-store";

const copy = {
  ru: { title: "Призы этого дня", automatic: "Автоматическое распределение фонда", manual: "Назначения администратора", preliminary: "Предварительные суммы: могут измениться вместе с рейтингом и настройками челленджа.", final: "Окончательные результаты", pool: "Общий фонд", place: "место", unavailable: "Пока не определено", none: "Без денежного приза", other: "Остальные денежные призы — до", retry: "Не удалось загрузить суммы. Повторить", login: "Войдите, чтобы увидеть актуальные призы" },
  en: { title: "Prizes for this day", automatic: "Automatic prize-pool allocation", manual: "Administrator's allocations", preliminary: "Provisional amounts: may change with the ranking and challenge settings.", final: "Final results", pool: "Total pool", place: "place", unavailable: "Not determined yet", none: "No cash prize", other: "Other cash prizes — up to", retry: "Could not load prizes. Retry", login: "Sign in to see current prizes" },
  uz: { title: "Shu kunning sovrinlari", automatic: "Jamg‘armaning avtomatik taqsimoti", manual: "Administrator belgilagan sovrinlar", preliminary: "Dastlabki summalar: reyting va sinov sozlamalari bilan birga o‘zgarishi mumkin.", final: "Yakuniy natijalar", pool: "Umumiy jamg‘arma", place: "o‘rin", unavailable: "Hali aniqlanmagan", none: "Pul sovrini yo‘q", other: "Boshqa pul sovrinlari — gacha", retry: "Summalarni yuklab bo‘lmadi. Qayta urinish", login: "Joriy sovrinlar uchun tizimga kiring" },
};

export function ChallengeRulePrizes({ dayKey }: { dayKey?: string }) {
  const { copyContent } = useUiCopy();
  const token = useAppStore(state => state.accessToken);
  const focused = useIsFocused();
  const theme = useAppTheme();
  const { language } = useTranslation();
  const c = copy[language];
  const query = useQuery({ queryKey: ["challenge-rule-prizes", token, dayKey], queryFn: () => challengesApi.rules(token!, dayKey), enabled: Boolean(token) && focused, staleTime: 0, refetchOnMount: "always", refetchInterval: focused ? 30_000 : false });
  const data = query.isError ? undefined : query.data;
  const cappedPool = data?.payoutPolicy === "all-six-percent-v2" || data?.payoutPolicy === "all-six-percent-v3";
  const variableTail = data?.payoutPolicy === "all-six-percent-v3";
  return <View style={styles.block}>
    <AppText variant="heading">{copyContent(c.title)}</AppText>
    {!token ? <AppText muted>{copyContent(c.login)}</AppText> : query.isPending ? <ActivityIndicator color={String(theme.primary)} /> : null}
    {query.isError ? <Pressable accessibilityRole="button" onPress={() => void query.refetch()}><AppText color={String(theme.primary)}>{copyContent(c.retry)}</AppText></Pressable> : null}
    {data ? <>
      <AppText variant="caption" muted>{copyContent(data.dayKey)} · {copyContent(data.source === "saved" ? c.final : data.source === "manual" ? c.manual : c.automatic)}</AppText>
      <View style={styles.row}><AppText>{copyContent(cappedPool ? language === "ru" ? "Максимальный фонд" : language === "uz" ? "Maksimal jamg‘arma" : "Maximum pool" : c.pool)}</AppText><AppText variant="label">{copyContent(formatMoney(data.poolUnits))}</AppText></View>
      {cappedPool ? <View style={styles.row}><AppText>{copyContent(language === "ru" ? "Текущий фонд выплат" : language === "uz" ? "Joriy to‘lovlar jamg‘armasi" : "Current payouts")}</AppText><AppText variant="label">{copyContent(formatMoney(data.poolUnits - (data.unallocatedUnits ?? 0)))}</AppText></View> : null}
      {data.payoutPolicy === "top-thirty-v1" ? <AppText variant="caption" muted>{copyContent(language === "ru"
        ? "Денежные призы — только для топ-30% рейтинга (с округлением вверх). Фонд — $10. Первые места: $2.50, $1, $0.50, $0.25; далее суммы уменьшаются до $0.01. При нехватке фонда оплачиваются только доступные места внутри топ-30%. Суммы предварительные до закрытия дня."
        : language === "uz" ? "Pul sovrinlari reytingdagi eng yaxshi 30% uchun (yuqoriga yaxlitlanadi). Jamg‘arma — $10. Birinchi o‘rinlar: $2.50, $1, $0.50, $0.25; keyin $0.01 gacha kamayadi. Mablag‘ yetmasa, faqat shu 30% ichidagi o‘rinlar to‘lanadi. Kun yakunigacha summalar dastlabki."
        : "Cash prizes go only to the top 30% (rounded up). Pool: $10. First places: $2.50, $1, $0.50, $0.25; then decreasing to $0.01. If funds are insufficient, only affordable places within the top 30% are paid. Amounts remain provisional until the day closes.")}</AppText> : null}
      {variableTail ? <AppText variant="caption" muted>{copyContent(language === "ru"
        ? "Денежный приз получает каждый, кто завершил все 6 игр дня. Первые 10 мест получают фиксированные призы; далее выплаты зависят от процентной группы. Последние 85% получают базовую сумму со случайной надбавкой. Фонд достигает $8.25 при 1500 участниках и не превышает этот лимит; при меньшем числе участников расход ниже. До закрытия дня состав участников и предварительные суммы могут меняться; после закрытия призы фиксируются."
        : language === "uz" ? "Kunning barcha 6 o‘yinini tugatgan har bir ishtirokchi pul sovrini oladi. Birinchi 10 o‘rin uchun sovrinlar belgilangan; keyingi to‘lovlar foizli guruhga bog‘liq. Oxirgi 85% asosiy summaga tasodifiy qo‘shimcha oladi. Jamg‘arma 1500 ishtirokchida $8.25 ga yetadi va bu limitdan oshmaydi; ishtirokchilar kamroq bo‘lsa, xarajat ham kamroq. Kun tugaguncha ishtirokchilar tarkibi va dastlabki summalar o‘zgarishi mumkin; yakunda sovrinlar qat’iy belgilanadi."
        : "Everyone who completes all 6 daily games earns a cash prize. The top 10 prizes are fixed; further payouts follow percentile groups. The last 85% receive a base amount plus a random bonus. Spending reaches $8.25 at 1500 participants and never exceeds that cap; fewer participants mean lower spending. Participation and provisional amounts may change until the day closes, when prizes become final.")}</AppText> : null}
      {!variableTail && data.payoutPolicy?.startsWith("all-six-percent-v") ? <AppText variant="caption" muted>{copyContent(language === "ru"
        ? "Денежный приз получает каждый, кто завершил все 6 игр дня. После первых трёх мест процентные группы определяют выплату каждому; расход зависит от числа участников."
        : language === "uz" ? "Kunning barcha 6 o‘yinini tugatgan har bir ishtirokchi pul sovrini oladi. Foizli guruhlar har bir kishining sovrinini belgilaydi; umumiy xarajat ishtirokchilar soniga bog‘liq."
        : "Everyone who completes all 6 daily games earns a cash prize. After the top three, per-person prizes follow percentile groups; total spending depends on participation.")}</AppText> : null}
      {data.cashPrizeLimitUnits != null ? <View style={styles.row}><AppText>{copyContent(language === "ru" ? "Максимум одному участнику" : language === "uz" ? "Bir ishtirokchiga eng ko‘pi" : "Maximum per participant")}</AppText><AppText variant="label">{copyContent(formatMoney(data.cashPrizeLimitUnits))}</AppText></View> : null}
      {(data.unallocatedUnits ?? 0) > 0 ? <View style={styles.row}><AppText>{copyContent(language === "ru" ? "Нераспределённый остаток" : language === "uz" ? "Taqsimlanmagan qoldiq" : "Unallocated balance")}</AppText><AppText variant="label">{copyContent(formatMoney(data.unallocatedUnits!))}</AppText></View> : null}
      {data.podium.map(row => <View key={row.rank} style={styles.row}><AppText>{copyContent(language === "ru" ? `${row.rank}-е место` : language === "uz" ? `${row.rank}-o‘rin` : `${row.rank}${row.rank === 1 ? "st" : row.rank === 2 ? "nd" : "rd"} place`)}</AppText><AppText variant="label">{copyContent(row.cashUnits === null ? c.unavailable : row.cashUnits === 0 ? c.none : formatMoney(row.cashUnits))}</AppText></View>)}
      {data.otherMaxCashUnits > 0 ? <AppText>{copyContent(language === "uz" ? `Boshqa pul sovrinlari — ${formatMoney(data.otherMaxCashUnits)} gacha.` : `${c.other} ${formatMoney(data.otherMaxCashUnits)}.`)}</AppText> : null}
      <AppText variant="caption" muted>{copyContent(data.final ? c.final : c.preliminary)}</AppText>
    </> : null}
  </View>;
}
const styles = StyleSheet.create({ block: { gap: 10, paddingVertical: 12 }, row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 } });
