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
  return <View style={styles.block}>
    <AppText variant="heading">{copyContent(c.title)}</AppText>
    {!token ? <AppText muted>{copyContent(c.login)}</AppText> : query.isPending ? <ActivityIndicator color={String(theme.primary)} /> : null}
    {query.isError ? <Pressable accessibilityRole="button" onPress={() => void query.refetch()}><AppText color={String(theme.primary)}>{copyContent(c.retry)}</AppText></Pressable> : null}
    {data ? <>
      <AppText variant="caption" muted>{copyContent(data.dayKey)} · {copyContent(data.source === "saved" ? c.final : data.source === "manual" ? c.manual : c.automatic)}</AppText>
      <View style={styles.row}><AppText>{copyContent(c.pool)}</AppText><AppText variant="label">{copyContent(formatMoney(data.poolUnits))}</AppText></View>
      {data.cashPrizeLimitUnits != null ? <View style={styles.row}><AppText>{copyContent(language === "ru" ? "Максимум одному участнику" : language === "uz" ? "Bir ishtirokchiga eng ko‘pi" : "Maximum per participant")}</AppText><AppText variant="label">{copyContent(formatMoney(data.cashPrizeLimitUnits))}</AppText></View> : null}
      {(data.unallocatedUnits ?? 0) > 0 ? <View style={styles.row}><AppText>{copyContent(language === "ru" ? "Нераспределённый остаток" : language === "uz" ? "Taqsimlanmagan qoldiq" : "Unallocated balance")}</AppText><AppText variant="label">{copyContent(formatMoney(data.unallocatedUnits!))}</AppText></View> : null}
      {data.podium.map(row => <View key={row.rank} style={styles.row}><AppText>{copyContent(language === "ru" ? `${row.rank}-е место` : language === "uz" ? `${row.rank}-o‘rin` : `${row.rank}${row.rank === 1 ? "st" : row.rank === 2 ? "nd" : "rd"} place`)}</AppText><AppText variant="label">{copyContent(row.cashUnits === null ? c.unavailable : row.cashUnits === 0 ? c.none : formatMoney(row.cashUnits))}</AppText></View>)}
      {data.otherMaxCashUnits > 0 ? <AppText>{copyContent(language === "uz" ? `Boshqa pul sovrinlari — ${formatMoney(data.otherMaxCashUnits)} gacha.` : `${c.other} ${formatMoney(data.otherMaxCashUnits)}.`)}</AppText> : null}
      <AppText variant="caption" muted>{copyContent(data.final ? c.final : c.preliminary)}</AppText>
    </> : null}
  </View>;
}
const styles = StyleSheet.create({ block: { gap: 10, paddingVertical: 12 }, row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 } });
