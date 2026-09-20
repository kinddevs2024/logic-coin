import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { GlassSurface } from "@/components/glass-surface";
import { ChallengeEmptyState } from "@/components/challenge-empty-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { challengesApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import type { TodayChallenges } from "@/types";

const copy = {
  ru: { completed: "пройдено", hint: "Сумма по текущему месту. Приз будет определён после завершения челленджа. Для получения приза необходимо участвовать в челлендже.", you: "Вы", login: "Войдите, чтобы увидеть рейтинг", retry: "Обновить рейтинг", close: "Закрыть", info: "О денежном призе" },
  en: { completed: "completed", hint: "Based on your current rank. The final prize is determined when the challenge ends. You must participate in the challenge to earn a prize.", you: "You", login: "Sign in to see the ranking", retry: "Refresh ranking", close: "Close", info: "About the cash prize" },
  uz: { completed: "bajarildi", hint: "Joriy o‘ringa asoslangan. Yakuniy mukofot sinov tugagach aniqlanadi. Mukofot uchun sinovda qatnashish kerak.", you: "Siz", login: "Reyting uchun tizimga kiring", retry: "Reytingni yangilash", close: "Yopish", info: "Pul mukofoti haqida" },
};
type Cursor = { snapshot: string; offset: number; end?: number };
const ROW = 46;
const HEIGHT = ROW * 3.5;

export function ChallengeProgress({ today }: { today?: TodayChallenges }) {
  if (today && !today.available) return <ChallengeEmptyState nextAt={today.nextChallengeAt} />;
  if (today?.available && today.endsAt && !today.games.some(game => game.state.status === "started" || game.state.status === "completed")) return <ChallengeReady today={today} />;
  return <ActiveChallengeProgress key={`${today?.dayKey}:${today?.totalCoinsToday}:${today?.completedCount}`} today={today} />;
}

function ChallengeReady({ today }: { today: TodayChallenges }) {
  const router = useRouter();
  const theme = useAppTheme();
  const { language } = useTranslation();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const end = Date.parse(today.endsAt ?? "");
  const seconds = Number.isFinite(end) ? Math.max(0, Math.floor((end - now) / 1000)) : 0;
  const countdown = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, "0")).join(":");
  const labels = {
    ru: { until: "До окончания челленджа", pool: "Призовой фонд" },
    en: { until: "Until the challenge ends", pool: "Prize pool" },
    uz: { until: "Sinov tugashigacha", pool: "Mukofot jamg‘armasi" },
  }[language];
  const firstGame = today.games[0];
  return <Pressable accessibilityRole="button" accessibilityLabel={language === "ru" ? "Начать челлендж с первой игры" : language === "uz" ? "Sinovni birinchi o‘yindan boshlash" : "Start challenge from the first game"} disabled={!firstGame || seconds === 0} onPress={() => {
    if (firstGame) router.push({ pathname: "/play/[gameKey]", params: { gameKey: firstGame.key, mode: "challenge" } } as never);
  }}><GlassSurface variant="strong" intensity={76} style={styles.ready}>
    <AppText style={styles.countdown} numberOfLines={1} adjustsFontSizeToFit>{countdown}</AppText>
    <AppText variant="caption" muted>{labels.until}</AppText>
    <View style={styles.pool}>
      <Ionicons name="trophy-outline" size={19} color={String(theme.primary)} />
      <AppText variant="caption" muted>{labels.pool}</AppText>
      <AppText variant="label">{formatMoney(today.prizes?.poolUnits ?? 0)}</AppText>
    </View>
  </GlassSurface></Pressable>;
}

function ActiveChallengeProgress({ today }: { today?: TodayChallenges }) {
  const theme = useAppTheme();
  const { language } = useTranslation();
  const token = useAppStore(s => s.accessToken);
  const focused = useIsFocused();
  const c = copy[language];
  const [info, setInfo] = useState(false);
  const client = useQueryClient();
  const queryKey = ["challenges", "progress-scroll", token, today?.dayKey, today?.totalCoinsToday, today?.completedCount];
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: undefined as Cursor | undefined,
    queryFn: ({ pageParam }) => challengesApi.progress(token!, pageParam),
    getNextPageParam: page => page.next ?? undefined,
    getPreviousPageParam: page => page.previous ?? undefined,
    enabled: Boolean(token && today?.available && focused),
    refetchOnWindowFocus: false, refetchOnMount: "always", staleTime: Infinity, gcTime: 0, retry: 1,
  });
  const pages = query.data?.pages ?? [];
  const progress = pages[0];
  const rows = pages.flatMap(page => page.neighbors);
  const list = useRef<ScrollView>(null);
  const position = useRef({ firstRank: 0, y: 0, initialized: false, programmatic: false });
  const busy = useRef(false);
  const reposition = () => {
    const state = position.current;
    const first = rows[0]?.rank ?? 0;
    if (!first) return;
    let target = state.y;
    if (!state.initialized) {
      const index = rows.findIndex(row => row.isSelf);
      target = Math.max(0, index * ROW - (HEIGHT - ROW) / 2);
      state.initialized = true;
    } else if (state.firstRank > first) target += (state.firstRank - first) * ROW;
    state.firstRank = first;
    if (Math.abs(target - state.y) > 1) {
      state.programmatic = true;
      state.y = target;
      list.current?.scrollTo({ y: target, animated: false });
    }
  };
  const refresh = () => {
    position.current = { firstRank: 0, y: 0, initialized: false, programmatic: false };
    void client.resetQueries({ queryKey, exact: true });
  };
  return <GlassSurface variant="strong" intensity={76} style={styles.card}>
    <View style={styles.metrics}>
      <View style={styles.score}>
        <Ionicons name="diamond-outline" size={22} color={String(theme.primary)} />
        <AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.45} style={styles.number}>{(progress?.self?.totalCoins ?? today?.totalCoinsToday ?? 0).toLocaleString(language)}</AppText>
      </View>
      <View style={styles.money}>
        <Ionicons name="cash-outline" size={19} color={String(theme.primary)} />
        <AppText variant="heading" style={{ flexShrink: 1 }}>{progress ? formatMoney(progress.projectedCashUnits) : "—"}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={c.info} hitSlop={8} onPress={() => setInfo(true)} style={styles.infoButton}>
          <Ionicons name="information-circle-outline" size={20} color={String(theme.textMuted)} />
        </Pressable>
      </View>
      <AppText variant="label" style={styles.completed}>{progress?.self?.completedGamesCount ?? today?.completedCount ?? 0}/{today?.totalCount ?? 0} <AppText variant="caption">{c.completed}</AppText></AppText>
    </View>
    <View style={[styles.ranking, { borderLeftColor: theme.glassBorder }]}>
      {!token ? <AppText variant="caption" muted>{c.login}</AppText> : query.isPending ? <ActivityIndicator color={String(theme.primary)} /> : <>
        <ScrollView ref={list} nestedScrollEnabled style={styles.viewport} showsVerticalScrollIndicator={false} scrollEventThrottle={32} onContentSizeChange={reposition}
          onScroll={event => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            const state = position.current;
            const previousY = state.y;
            state.y = contentOffset.y;
            if (state.programmatic) { state.programmatic = false; return; }
            if (!state.initialized || busy.current || query.isFetching || query.isError || Math.abs(previousY - contentOffset.y) < 1) return;
            const up = contentOffset.y < previousY && contentOffset.y < ROW;
            const down = contentOffset.y > previousY && contentSize.height - contentOffset.y - layoutMeasurement.height < ROW;
            if ((up && query.hasPreviousPage) || (down && query.hasNextPage)) {
              busy.current = true;
              void (up ? query.fetchPreviousPage() : query.fetchNextPage()).finally(() => { busy.current = false; });
            }
          }}>
          {rows.map(row => <View key={row.userId} style={[styles.row, row.isSelf && { backgroundColor: theme.primarySoft, borderColor: theme.primary }]}>
            <Avatar name={row.name} avatarUrl={row.avatarUrl} size={26} />
            <View style={styles.person}>
              <AppText variant="caption" numberOfLines={1}>{row.rank} · {row.isSelf ? c.you : row.name}</AppText>
              <AppText variant="label" numberOfLines={1}>{row.totalCoins.toLocaleString(language)}</AppText>
            </View>
          </View>)}
        </ScrollView>
        {query.isFetchingNextPage || query.isFetchingPreviousPage ? <ActivityIndicator style={styles.loading} size="small" color={String(theme.primary)} /> : null}
        {query.isError ? <Pressable onPress={refresh}><AppText variant="caption">{c.retry}</AppText></Pressable> : null}
      </>}
    </View>
    <Modal visible={info} transparent animationType="fade" onRequestClose={() => setInfo(false)}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel={c.close} style={StyleSheet.absoluteFill} onPress={() => setInfo(false)} />
        <GlassSurface variant="strong" style={styles.explanation}>
          <AppText>{c.hint}</AppText>
          <Pressable accessibilityRole="button" onPress={() => setInfo(false)}><AppText variant="label" color={String(theme.primary)}>{c.close}</AppText></Pressable>
        </GlassSurface>
      </View>
    </Modal>
  </GlassSurface>;
}
const styles = StyleSheet.create({
  ready: { borderRadius: 30, padding: 24, minHeight: 216, alignItems: "center", justifyContent: "center", gap: 6 },
  countdown: { fontSize: 56, lineHeight: 66, fontWeight: "900", fontVariant: ["tabular-nums"] },
  pool: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 16 },
  card: { borderRadius: 30, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  metrics: { width: "47%", paddingRight: 8, minWidth: 0 },
  score: { flexDirection: "row", alignItems: "center", gap: 5 },
  number: { fontSize: 46, lineHeight: 56, fontWeight: "900", flexShrink: 1, minWidth: 0, letterSpacing: -1.5 },
  completed: { marginTop: 20, fontSize: 17, lineHeight: 24 },
  money: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 20 },
  infoButton: { minWidth: 24, minHeight: 40, alignItems: "center", justifyContent: "center" },
  ranking: { width: "53%", borderLeftWidth: 1, paddingLeft: 8, minWidth: 0, minHeight: HEIGHT, justifyContent: "center" },
  viewport: { height: HEIGHT, flexGrow: 0, borderRadius: 14 },
  row: { height: ROW, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 5, borderRadius: 14, borderWidth: 1, borderColor: "transparent" },
  person: { flex: 1, minWidth: 0 },
  loading: { position: "absolute", bottom: 2, right: 4 },
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.5)" },
  explanation: { width: "100%", maxWidth: 420, padding: 24, borderRadius: 24, gap: 20 },
});
