import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { challengesApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import type { TodayChallenges } from "@/types";

const copy = {
  ru: { points: "Баллы", completed: "игр пройдено", prize: "Предварительный приз", hint: "Сумма по текущему месту. Приз будет определён после завершения челленджа.", rating: "Рейтинг", you: "Вы", empty: "Пока нет участников", join: "Пройдите игру, чтобы попасть в рейтинг", login: "Войдите, чтобы увидеть рейтинг", retry: "Повторить загрузку" },
  en: { points: "Points", completed: "games completed", prize: "Estimated prize", hint: "Based on your current rank. The final prize is determined when the challenge ends.", rating: "Ranking", you: "You", empty: "No participants yet", join: "Finish a game to join the ranking", login: "Sign in to see the ranking", retry: "Retry loading" },
  uz: { points: "Ballar", completed: "o‘yin bajarildi", prize: "Taxminiy mukofot", hint: "Joriy o‘ringa asoslangan. Yakuniy mukofot sinov tugagach aniqlanadi.", rating: "Reyting", you: "Siz", empty: "Hali ishtirokchilar yo‘q", join: "Reytingga kirish uchun o‘yinni yakunlang", login: "Reyting uchun tizimga kiring", retry: "Qayta yuklash" },
};

export function ChallengeProgress({ today }: { today?: TodayChallenges }) {
  const theme = useAppTheme();
  const { language } = useTranslation();
  const token = useAppStore(s => s.accessToken);
  const focused = useIsFocused();
  const c = copy[language];
  const query = useQuery({
    queryKey: ["challenges", "progress", token, today?.dayKey, today?.totalCoinsToday, today?.completedCount],
    queryFn: () => challengesApi.progress(token!),
    enabled: Boolean(token && today?.available && focused),
    refetchInterval: focused ? 30_000 : false,
    staleTime: 15_000,
    retry: 1,
  });
  const progress = query.data?.dayKey === today?.dayKey ? query.data : undefined;
  return <GlassSurface variant="strong" intensity={76} style={styles.card}>
    <View style={styles.metrics}>
      <AppText variant="caption" muted>{c.points}</AppText>
      <View style={styles.score}>
        <Ionicons name="diamond-outline" size={22} color={String(theme.primary)} />
        <AppText style={styles.number}>{(progress?.self?.totalCoins ?? today?.totalCoinsToday ?? 0).toLocaleString(language)}</AppText>
      </View>
      <AppText variant="label" style={styles.completed}>{progress?.self?.completedGamesCount ?? today?.completedCount ?? 0} / {today?.totalCount ?? 0}</AppText>
      <AppText variant="caption" muted>{c.completed}</AppText>
      <View style={styles.money}>
        <Ionicons name="cash-outline" size={20} color={String(theme.primary)} />
        <AppText variant="heading">{progress ? formatMoney(progress.projectedCashUnits) : "—"}</AppText>
      </View>
      <AppText variant="caption" muted>{c.prize}</AppText>
    </View>
    <View style={[styles.ranking, { borderLeftColor: theme.glassBorder }]}>
      <AppText variant="caption" muted>{c.rating}</AppText>
      {!token ? <AppText variant="caption" muted>{c.login}</AppText> : query.isPending && today?.available ? <ActivityIndicator color={String(theme.primary)} /> : query.isError ? <Pressable onPress={() => void query.refetch()}><AppText variant="caption">{c.retry}</AppText></Pressable> : <>
        {(progress?.neighbors ?? []).map(row => <View key={row.userId} style={[styles.row, row.isSelf && { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
          <AppText style={styles.rank} muted={!row.isSelf}>{row.rank}</AppText>
          <Avatar name={row.name} avatarUrl={row.avatarUrl} size={26} />
          <View style={styles.person}>
            <AppText variant="caption" numberOfLines={1}>{row.isSelf ? c.you : row.name}</AppText>
            <AppText variant="label" numberOfLines={1}>{row.totalCoins.toLocaleString(language)}</AppText>
          </View>
        </View>)}
        {!progress?.neighbors.length ? <AppText variant="caption" muted>{c.empty}</AppText> : null}
        {progress && !progress.self ? <AppText variant="caption" muted>{c.join}</AppText> : null}
      </>}
    </View>
    <View style={styles.note}>
      <Ionicons name="information-circle-outline" size={15} color={String(theme.textMuted)} />
      <AppText variant="caption" muted style={{ flex: 1, fontSize: 10 }}>{c.hint}</AppText>
    </View>
  </GlassSurface>;
}
const styles = StyleSheet.create({
  card: { borderRadius: 30, padding: 16, flexDirection: "row", flexWrap: "wrap", alignItems: "center", overflow: "hidden" },
  metrics: { width: "47%", paddingRight: 12, minWidth: 0 },
  score: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 },
  number: { fontSize: 28, lineHeight: 34, fontWeight: "900", flexShrink: 1 },
  completed: { marginTop: 18, fontSize: 19 },
  money: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 18 },
  ranking: { width: "53%", borderLeftWidth: 1, paddingLeft: 10, gap: 5, minWidth: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 5, padding: 5, borderRadius: 14, borderWidth: 1, borderColor: "transparent", minHeight: 48 },
  rank: { minWidth: 15, fontSize: 10 },
  person: { flex: 1, minWidth: 0 },
  note: { width: "100%", flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 14 },
});
