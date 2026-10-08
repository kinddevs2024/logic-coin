import Ionicons from "@expo/vector-icons/Ionicons";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { gameCoverFor } from "@/constants/game-covers";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { GlassSurface } from "@/components/glass-surface";
import { ChallengeEmptyState } from "@/components/challenge-empty-state";
import { ChallengeRulePrizes } from "@/components/challenge-rule-prizes";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { challengesApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import type { TodayChallenges } from "@/types";

const copy = {
  ru: { completed: "пройдено", hint: "Здесь показан общий призовой фонд челленджа за этот день, а не ваш заработок. После завершения челленджа фонд распределяется между участниками по результатам или назначениям администратора.", you: "Вы", login: "Войдите, чтобы увидеть рейтинг", retry: "Обновить рейтинг", close: "Закрыть", info: "О призовом фонде" },
  en: { completed: "completed", hint: "This is the total prize pool for this day’s challenge, not your earnings. After the challenge ends, prizes are allocated by results or the administrator’s assignments.", you: "You", login: "Sign in to see the ranking", retry: "Refresh ranking", close: "Close", info: "About the prize pool" },
  uz: { completed: "bajarildi", hint: "Bu sizning daromadingiz emas, shu kunning sinovi uchun umumiy mukofot jamg‘armasi. Sinov tugagach mukofotlar natijalar yoki administrator belgilagan summalar bo‘yicha taqsimlanadi.", you: "Siz", login: "Reyting uchun tizimga kiring", retry: "Reytingni yangilash", close: "Yopish", info: "Mukofot jamg‘armasi haqida" },
};
type Cursor = { snapshot: string; offset: number; end?: number };
const challengeRules = {
  ru: {
    title: "Правила челленджа",
    paragraphs: [
      "Ежедневный челлендж состоит из шести игр. Заверши все игры дня. Перед началом можно потренироваться в разделе «Игры». Основное прохождение доступно один раз в день; дополнительные попытки возможны только по предусмотренным в приложении правилам.",
      "Счёт начинается с нуля. Коины зависят от результата: правильных действий и прохождения игры. Результат и начисление сохраняются на сервере — для этого нужен интернет. Повтор уже зачтённой игры сам по себе не начисляет новую награду.",
      "Место в рейтинге определяется коинами текущего челленджа. При одинаковой сумме выше участник, прошедший больше игр; затем учитывается время завершения.",
      "Реклама и подарки могут дать дополнительные коины, время или разрешённый повтор. Рекламная награда начисляется только после подтверждённого просмотра; она не гарантируется, если реклама недоступна.",
      "Денежные призы определяются настройками именно этого дня: автоматически из общего фонда либо вручную администратором. Ниже показаны актуальные суммы за первое, второе и третье места. Пока итоги не опубликованы, суммы могут меняться. Общий фонд — не твой баланс. Коины не равны долларам, участие не гарантирует получение денежного приза.",
    ],
  },
  en: {
    title: "Challenge rules",
    paragraphs: [
      "The daily challenge contains six games. Complete all games for the day. You can practice in the Games section first. The main run is available once a day; extra attempts are allowed only under the rules provided in the app.",
      "Your score starts at zero. Coins depend on your performance and correct actions. Results and rewards are saved on the server, so internet access is required. Replaying an already credited game does not automatically earn a new reward.",
      "Ranking is based on coins earned in this challenge. Ties are resolved by the number of completed games, then completion time.",
      "Ads and gifts may provide extra coins, time or an authorized replay. Ad rewards require a verified viewing and are not guaranteed when ads are unavailable.",
      "Cash prizes come from this day's settings: automatically from its prize pool or assigned manually by the administrator. Current first-, second- and third-place amounts appear below. Amounts may change until results are published. The pool is not your balance. Coins are not dollars, and participation does not guarantee a cash prize.",
    ],
  },
  uz: {
    title: "Sinov qoidalari",
    paragraphs: [
      "Kunlik sinov oltita o‘yindan iborat. Shu kunning barcha o‘yinlarini yakunlang. Avval «O‘yinlar» bo‘limida mashq qilishingiz mumkin. Asosiy ishtirok kuniga bir marta; qo‘shimcha urinishlar faqat ilovada ko‘rsatilgan qoidalarga muvofiq beriladi.",
      "Hisob noldan boshlanadi. Coinlar to‘g‘ri harakatlar va o‘yin natijasiga bog‘liq. Natija va mukofot serverda saqlanadi, buning uchun internet kerak. Avval hisoblangan o‘yinni takrorlash o‘z-o‘zidan yangi mukofot bermaydi.",
      "Reyting shu sinovda yig‘ilgan coinlar bo‘yicha tuziladi. Coinlar teng bo‘lsa, ko‘proq o‘yin tugatgan qatnashchi yuqorida turadi; keyin tugatish vaqti hisobga olinadi.",
      "Reklama va sovg‘alar qo‘shimcha coin, vaqt yoki ruxsat etilgan qayta o‘ynash imkonini berishi mumkin. Reklama mukofoti ko‘rish tasdiqlangandan so‘ng beriladi; reklama mavjud bo‘lmasa mukofot kafolatlanmaydi.",
      "Pul sovrinlari aynan shu kunning sozlamalaridan olinadi: umumiy jamg‘armadan avtomatik hisoblanadi yoki administrator qo‘lda belgilaydi. Quyida birinchi, ikkinchi va uchinchi o‘rin uchun joriy summalar ko‘rsatilgan. Natijalar e’lon qilinmaguncha summalar o‘zgarishi mumkin. Jamg‘arma sizning balansingiz emas. Coin dollar emas; ishtirok pul sovrinini kafolatlamaydi.",
    ],
  },
};
const ROW = 46;
const HEIGHT = ROW * 3.5;

export function ChallengeProgress({ today }: { today?: TodayChallenges }) {
  if (today && !today.available) return <ChallengeEmptyState nextAt={today.nextChallengeAt} />;
  if (today?.available && today.endsAt && !today.totalCoinsToday && !today.games.some(game => game.state.status === "started" || game.state.status === "completed")) return <ChallengeReady today={today} />;
  return <ActiveChallengeProgress key={`${today?.dayKey}:${today?.revision}:${today?.totalCoinsToday}:${today?.completedCount}`} today={today} />;
}

function ChallengeReady({ today }: { today: TodayChallenges }) {
  const focused = useIsFocused();
  const [info, setInfo] = useState(false);
  // Reset this small clock when focus changes so the first visible render uses
  // current time, including the expired button state, without a hidden timer.
  return <><ChallengeReadyClock key={focused ? "focused" : "hidden"} today={today} focused={focused} onRules={() => setInfo(true)} /><ChallengeRulesModal visible={info} dayKey={today.dayKey} onClose={() => setInfo(false)} /></>;
}

function ChallengeReadyClock({ today, focused, onRules }: { today: TodayChallenges; focused: boolean; onRules: () => void }) {
  const router = useRouter();
  const theme = useAppTheme();
  const { language } = useTranslation();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!focused) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [focused]);
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
      <Pressable accessibilityRole="button" accessibilityLabel={challengeRules[language].title} hitSlop={8} onPress={event => { event.stopPropagation(); onRules(); }} style={styles.infoButton}><Ionicons name="information-circle-outline" size={20} color={String(theme.textMuted)} /></Pressable>
    </View>
  </GlassSurface></Pressable>;
}

function ActiveChallengeProgress({ today }: { today?: TodayChallenges }) {
  const theme = useAppTheme();
  const { language } = useTranslation();
  const token = useAppStore(s => s.accessToken);
  const currentUser = useAppStore(s => s.user);
  const focused = useIsFocused();
  const c = copy[language];
  const rules = challengeRules[language];
  const [info, setInfo] = useState(false);
  const [details, setDetails] = useState(false);
  const client = useQueryClient();
  const queryKey = ["challenges", "progress-scroll", token, today?.dayKey, today?.revision, today?.totalCoinsToday, today?.completedCount];
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
  const rankingKey = ["challenges", "details-ranking", token, today?.dayKey, today?.revision];
  const ranking = useInfiniteQuery({
    queryKey: rankingKey,
    initialPageParam: undefined as Cursor | undefined,
    queryFn: async ({ pageParam }) => {
      if (pageParam) return challengesApi.progress(token!, pageParam);
      // Never reuse the compact card's potentially expired snapshot.
      const fresh = await challengesApi.progress(token!);
      return fresh.previous
        ? challengesApi.progress(token!, { snapshot: fresh.previous.snapshot, offset: 0 })
        : fresh;
    },
    getNextPageParam: page => page.next ?? undefined,
    enabled: Boolean(details && token && today?.available && query.isSuccess),
    retry: 1,
    gcTime: 0,
  });
  const detailRows = ranking.data?.pages.flatMap(page => page.neighbors) ?? [];
  const rows = pages.flatMap(page => page.neighbors);
  const selfRow = detailRows.find(row => row.isSelf) ?? rows.find(row => row.isSelf);
  const selfStats = ranking.data?.pages[0]?.self ?? progress?.self;
  const [detailsScrollY] = useState(() => new Animated.Value(0));
  const [detailsHeight, setDetailsHeight] = useState(0);
  const [summaryHeight, setSummaryHeight] = useState(0);
  const [detailsContentHeight, setDetailsContentHeight] = useState(0);
  const detailPageLoading = useRef(false);
  const loadDetailPage = () => {
    if (detailPageLoading.current || !ranking.hasNextPage || ranking.isFetching || ranking.isError) return;
    detailPageLoading.current = true;
    void ranking.fetchNextPage().finally(() => { detailPageLoading.current = false; });
  };
  useEffect(() => {
    if (details && detailsHeight > 0 && detailsContentHeight > 0 && detailsContentHeight <= detailsHeight + 40) loadDetailPage();
  }, [details, detailsHeight, detailsContentHeight, detailRows.length, ranking.isFetching, ranking.hasNextPage]);
  const selfIndex = detailRows.findIndex(row => row.isSelf);
  const dockTravel = Math.max(1, detailsHeight - 80);
  const dockY = selfIndex < 0 ? dockTravel : Animated.subtract(summaryHeight + 12 + selfIndex * 84, detailsScrollY).interpolate({ inputRange: [0, dockTravel], outputRange: [0, dockTravel], extrapolate: "clamp" });
  const fadeClear = theme.mode === "dark" ? "rgba(15,23,42,0)" : "rgba(240,249,255,0)";
  const topFadeOpacity = detailsScrollY.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: "clamp" });
  useEffect(() => { if (!details) detailsScrollY.setValue(0); }, [details, detailsScrollY]);
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
  return <><Pressable accessibilityRole="button" accessibilityLabel={c.info} onPress={() => setDetails(true)}><GlassSurface variant="strong" intensity={76} style={styles.card}>
    <View style={styles.metrics}>
      <View style={styles.score}>
        <Ionicons name="diamond-outline" size={22} color={String(theme.primary)} />
        <AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.45} style={styles.number}>{(progress?.self?.totalCoins ?? today?.totalCoinsToday ?? 0).toLocaleString(language)}</AppText>
      </View>
      <View style={styles.money}>
        <Ionicons name="cash-outline" size={19} color={String(theme.primary)} />
        <AppText variant="heading" style={{ flexShrink: 1 }}>{today?.prizes ? formatMoney(today.prizes.poolUnits) : "—"}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={rules.title} hitSlop={8} onPress={(event) => { event.stopPropagation(); setInfo(true); }} style={styles.infoButton}>
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
              <AppText variant="caption" numberOfLines={2}>{row.rank} · {row.name}</AppText>
            </View>
          </View>)}
        </ScrollView>
        {query.isFetchingNextPage || query.isFetchingPreviousPage ? <ActivityIndicator style={styles.loading} size="small" color={String(theme.primary)} /> : null}
        {query.isError ? <Pressable onPress={refresh}><AppText variant="caption">{c.retry}</AppText></Pressable> : null}
      </>}
    </View>
    </GlassSurface></Pressable>
    {details ? <Modal visible animationType="slide" onRequestClose={() => setDetails(false)}>
      <SafeAreaView style={[styles.detailsScreen, { backgroundColor: theme.background }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={c.close} onPress={() => setDetails(false)} style={styles.detailsClose}><Ionicons name="close" size={28} color={String(theme.primary)} /></Pressable>
        <View style={{ flex: 1 }} onLayout={event => setDetailsHeight(event.nativeEvent.layout.height)}>
        <Animated.FlatList data={detailRows} keyExtractor={row => row.userId} contentContainerStyle={styles.detailsContent} onContentSizeChange={(_width, height) => setDetailsContentHeight(height)} scrollEventThrottle={16} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: detailsScrollY } } }], { useNativeDriver: Platform.OS !== "web" })} initialNumToRender={8} maxToRenderPerBatch={4} windowSize={5} onEndReachedThreshold={0.3} onEndReached={loadDetailPage}
        renderItem={({ item: row }) => <GlassSurface variant="strong" style={[styles.detailsRank, row.isSelf && { opacity: 0 }]}><AppText variant="label" style={{ width: 24, textAlign: "center", color: row.rank <= 3 ? "#EFA215" : theme.textMuted }}>{row.rank}</AppText><Avatar name={row.name} avatarUrl={row.avatarUrl} size={44} /><AppText numberOfLines={1} style={{ flex: 1, fontWeight: "700" }}>{row.name}</AppText><View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Ionicons name="diamond-outline" size={16} color={String(theme.primary)} /><AppText variant="label">{row.totalCoins}</AppText></View></GlassSurface>}
        ListHeaderComponent={
        <View onLayout={event => setSummaryHeight(event.nativeEvent.layout.height)}><GlassSurface variant="strong" style={styles.detailsSummary}>
          <View style={styles.detailsMetrics}>
          <View style={styles.detailsMetricRow}>
            <Ionicons name="diamond-outline" size={24} color={String(theme.primary)} />
            <AppText variant="heading" numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1, fontSize: 28, lineHeight: 36 }}>{(progress?.self?.totalCoins ?? today?.totalCoinsToday ?? 0).toLocaleString(language)} coin</AppText>
          </View>
          <View style={styles.detailsMetricRow}>
            <Ionicons name="cash-outline" size={24} color={String(theme.primary)} />
            <AppText variant="label" numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1 }}>{formatMoney(today?.prizes?.poolUnits ?? 0)}</AppText>
          </View>
          <AppText variant="label">{today?.completedCount ?? 0}/{today?.totalCount ?? 0} {c.completed}</AppText>
          </View>
          <View style={styles.detailsGames}>
          {(today?.games ?? []).map(game => <View key={game.key} accessibilityLabel={`${game.title}: ${game.state.coinsAwarded} coin`} style={styles.detailsGame}><Image source={gameCoverFor(game.key)} style={styles.detailsGameIcon} resizeMode="contain" /><AppText variant="label">+{game.state.coinsAwarded}</AppText></View>)}
          </View>
        </GlassSurface></View>}
        ListFooterComponent={ranking.isError ? <Pressable onPress={() => void client.resetQueries({ queryKey: rankingKey, exact: true })}><AppText>{c.retry}</AppText></Pressable> : ranking.isPending || ranking.isFetchingNextPage ? <ActivityIndicator color={String(theme.primary)} /> : null} />
        <Animated.View pointerEvents="none" style={[styles.detailsFadeTop, { opacity: topFadeOpacity }]}><LinearGradient colors={[String(theme.background), fadeClear]} style={StyleSheet.absoluteFill} /></Animated.View>
        <LinearGradient pointerEvents="none" colors={[fadeClear, String(theme.background)]} style={styles.detailsFadeBottom} />
        {selfStats ? <Animated.View pointerEvents="none" style={[styles.detailsSelf, { transform: [{ translateY: dockY }] }]}><GlassSurface variant="strong" style={[styles.detailsRank, { borderColor: theme.primary, borderWidth: 1 }]}>
          <AppText variant="label" style={{ width: 24, textAlign: "center" }}>{selfStats.rank}</AppText>
          <Avatar name={selfRow?.name ?? currentUser.name} avatarUrl={selfRow?.avatarUrl ?? currentUser.avatarUrl} size={44} />
          <AppText numberOfLines={1} style={{ flex: 1, fontWeight: "700" }}>{c.you}: {selfRow?.name ?? currentUser.name}</AppText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Ionicons name="diamond-outline" size={16} color={String(theme.primary)} /><AppText variant="label">{selfStats.totalCoins}</AppText></View>
        </GlassSurface></Animated.View> : null}
        </View>
      </SafeAreaView>
    </Modal> : null}
    <ChallengeRulesModal visible={info} dayKey={today?.dayKey} onClose={() => setInfo(false)} />
  </>;
}

function ChallengeRulesModal({ visible, dayKey, onClose }: { visible: boolean; dayKey?: string; onClose: () => void }) {
  const theme = useAppTheme();
  const { language } = useTranslation();
  const rules = challengeRules[language];
  const c = copy[language];
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel={c.close} style={StyleSheet.absoluteFill} onPress={onClose} />
        <GlassSurface variant="strong" style={styles.explanation}>
          <AppText variant="heading" accessibilityRole="header">{rules.title}</AppText>
          <ScrollView style={styles.rulesScroll} contentContainerStyle={styles.rulesContent} showsVerticalScrollIndicator>
            {rules.paragraphs.map((paragraph, index) => <AppText key={index}>{index + 1}. {paragraph}</AppText>)}
            {visible ? <ChallengeRulePrizes dayKey={dayKey} /> : null}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onClose}><AppText variant="label" color={String(theme.primary)}>{c.close}</AppText></Pressable>
        </GlassSurface>
      </View>
    </Modal>;
}
const styles = StyleSheet.create({
  detailsScreen: { flex: 1 },
  detailsClose: { alignSelf: "flex-end", padding: 16 },
  detailsContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 12 },
  detailsSummary: { padding: 18, borderRadius: 28, flexDirection: "row", gap: 16 },
  detailsMetrics: { flex: 1, justifyContent: "center", gap: 16 },
  detailsSelf: { position: "absolute", top: 0, left: 20, right: 20 },
  detailsFadeTop: { position: "absolute", top: 0, left: 0, right: 0, height: 18 },
  detailsFadeBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 88 },
  detailsMetricRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  detailsGames: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignContent: "center", gap: 4 },
  detailsGame: { width: "31%", alignItems: "center", gap: 4, paddingVertical: 8 },
  detailsGameIcon: { width: 38, height: 38, borderRadius: 19, overflow: "hidden" },
  detailsRank: { height: 72, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, borderRadius: 18 },
  ready: { borderRadius: 30, padding: 24, minHeight: 216, alignItems: "center", justifyContent: "center", gap: 6 },
  countdown: { fontSize: 56, lineHeight: 66, fontWeight: "900", fontVariant: ["tabular-nums"] },
  pool: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 16 },
  card: { borderRadius: 30, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  metrics: { width: "47%", paddingRight: 8, minWidth: 0, height: HEIGHT, paddingVertical: 10, justifyContent: "space-between" },
  score: { flexDirection: "row", alignItems: "center", gap: 5 },
  number: { fontSize: 46, lineHeight: 56, fontWeight: "900", flexShrink: 1, minWidth: 0, letterSpacing: -1.5 },
  completed: { fontSize: 17, lineHeight: 24 },
  money: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  infoButton: { minWidth: 24, minHeight: 40, alignItems: "center", justifyContent: "center" },
  ranking: { width: "53%", borderLeftWidth: 1, paddingLeft: 8, minWidth: 0, minHeight: HEIGHT, justifyContent: "center" },
  viewport: { height: HEIGHT, flexGrow: 0, borderRadius: 14 },
  row: { height: ROW, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 5, borderRadius: 14, borderWidth: 1, borderColor: "transparent" },
  person: { flex: 1, minWidth: 0 },
  loading: { position: "absolute", bottom: 2, right: 4 },
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.5)" },
  explanation: { width: "100%", maxWidth: 420, maxHeight: "85%", padding: 24, borderRadius: 24, gap: 20 },
  rulesScroll: { flexShrink: 1 },
  rulesContent: { gap: 14 },
});
