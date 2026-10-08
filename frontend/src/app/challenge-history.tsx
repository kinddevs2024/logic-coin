import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { IconButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenHeader } from "@/components/screen-header";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { challengesApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

const labels = {
  ru: { title: "История челленджей", live: "Текущий рейтинг · день ещё не завершён", final: "Итоговый рейтинг", pending: "Результаты ещё не опубликованы", missing: "В этот день челленджа не было", empty: "Нет участников", retry: "Повторить", more: "Показать ещё", calendar: "Выбрать дату", close: "Закрыть", login: "Войдите, чтобы увидеть историю", year: "Год", month: "Месяц", back: "Назад", next: "Вперёд" },
  en: { title: "Challenge history", live: "Live ranking · day not finished", final: "Final ranking", pending: "Results not published yet", missing: "No challenge on this day", empty: "No participants", retry: "Retry", more: "Show more", calendar: "Choose date", close: "Close", login: "Sign in to see history", year: "Year", month: "Month", back: "Previous", next: "Next" },
  uz: { title: "Sinovlar tarixi", live: "Joriy reyting · kun tugamagan", final: "Yakuniy reyting", pending: "Natijalar hali e’lon qilinmagan", missing: "Bu kuni sinov bo‘lmagan", empty: "Qatnashchilar yo‘q", retry: "Qayta urinish", more: "Yana ko‘rsatish", calendar: "Sanani tanlash", close: "Yopish", login: "Tarix uchun tizimga kiring", year: "Yil", month: "Oy", back: "Oldingi", next: "Keyingi" },
};
export default function ChallengeHistory() {
  const router = useRouter();
  const theme = useAppTheme();
  const { isDesktop, isTablet } = useResponsiveLayout();
  const pageInset = isDesktop ? 32 : isTablet ? 24 : 20;
  const [stripWidth, setStripWidth] = useState(0);
  const dateStrip = useRef<ScrollView>(null);
  const { language } = useTranslation();
  const c = labels[language];
  const token = useAppStore(state => state.accessToken);
  const currentUser = useAppStore(state => state.user);
  const [scrollY] = useState(() => new Animated.Value(0));
  const [viewportHeight, setViewportHeight] = useState(0);
  const [rankingTop, setRankingTop] = useState(0);
  const [day, setDay] = useState<string>();
  const [calendar, setCalendar] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const query = useInfiniteQuery({ queryKey: ["challenge-history", token, day], initialPageParam: 0,
    queryFn: ({ pageParam }) => challengesApi.history(token!, day, pageParam),
    getNextPageParam: page => page.nextOffset ?? undefined, enabled: Boolean(token), retry: 1, placeholderData: previous => previous });
  const response = query.data?.pages[0];
  const data = !day || response?.dayKey === day ? response : undefined;
  const today = response?.today;
  const loadingPage = useRef(false);
  const loadMore = () => {
    if (loadingPage.current || !query.hasNextPage || query.isFetching || query.isError) return;
    loadingPage.current = true;
    void query.fetchNextPage().finally(() => { loadingPage.current = false; });
  };
  const selected = day ?? data?.today;
  const rows = data ? query.data?.pages.flatMap(page => page.rows) ?? [] : [];
  const ownIndex = rows.findIndex(row => row.isSelf);
  const dockTravel = Math.max(1, viewportHeight - 86);
  const dockY = ownIndex < 0 ? dockTravel : Animated.subtract(rankingTop + ownIndex * 72, scrollY).interpolate({ inputRange: [0, dockTravel], outputRange: [0, dockTravel], extrapolate: "clamp" });
  const locale = language === "uz" ? "uz-UZ" : language === "ru" ? "ru-RU" : "en-US";
  const formatDay = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long" });
  const select = (value: string) => { setDay(value); setCalendar(false); };
  const days = selected ? Array.from({ length: 91 }, (_, index) => index - 45).map(offset => {
    const date = new Date(`${selected}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }) : [];
  const monthDays = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const openCalendar = () => {
    const date = new Date(`${selected ?? new Date().toISOString().slice(0, 10)}T12:00:00Z`);
    setYear(date.getUTCFullYear()); setMonth(date.getUTCMonth()); setCalendar(true);
  };
  const page = <>
    <View style={styles.header}><IconButton name="chevron-back" label={c.back} onPress={() => router.back()} /><AppText style={styles.title}>{c.title}</AppText><IconButton name="calendar-outline" label={c.calendar} onPress={openCalendar} /></View>
    <View onLayout={event => setStripWidth(event.nativeEvent.layout.width)} style={{ marginHorizontal: -pageInset, marginBottom: 10, height: 64 }}>
    {stripWidth > 0 && selected ? <ScrollView key={`${selected}:${stripWidth}`} ref={dateStrip} horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={stripWidth / 7} contentOffset={{ x: 45 * stripWidth / 7, y: 0 }} contentContainerStyle={{ paddingHorizontal: 3 * stripWidth / 7 }} onMomentumScrollEnd={({ nativeEvent }) => {
      let index = Math.max(0, Math.min(days.length - 1, Math.round(nativeEvent.contentOffset.x / (stripWidth / 7))));
      while (index > 0 && today && days[index]! > today) index--;
      const value = days[index];
      if (value && today && value <= today) {
        if (value === selected) dateStrip.current?.scrollTo({ x: index * stripWidth / 7, animated: true });
        else select(value);
      }
    }}>
      {days.map(value => {
        const disabled = !today || value > today;
        const chosen = value === selected;
        const status = data?.dayStatuses?.[value] ?? (chosen ? data?.status : undefined);
        const unfinished = status === "live" || status === "pending";
        return <Pressable key={value} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${formatDay(value)}${status ? `, ${c[status]}` : ""}`} accessibilityState={{ selected: chosen, disabled }} onPress={() => select(value)} style={[styles.dayChip, { width: stripWidth / 7, opacity: disabled ? 0.3 : 1, backgroundColor: chosen ? theme.primarySoft : "transparent", gap: 5 }]}><AppText style={{ fontSize: chosen ? 24 : 18, fontWeight: chosen ? "800" : "500" }} color={String(chosen ? theme.primary : theme.textMuted)}>{Number(value.slice(8))}</AppText><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#E7B43B", opacity: !disabled && unfinished ? 1 : 0 }} /></Pressable>;
      })}
    </ScrollView> : null}
    </View>
    {data && (data.status === "pending" || data.status === "missing") ? <AppText muted style={styles.status}>{c[data.status]}</AppText> : null}
    {!token ? <AppText>{c.login}</AppText> : query.isPending || query.isPlaceholderData ? <ActivityIndicator color={String(theme.primary)} /> : null}
    <View onLayout={event => setRankingTop(event.nativeEvent.layout.y)}>
    {rows.map(row => <GlassSurface key={row.userId} style={[styles.row, { height: 64 }, row.isSelf && data?.self && { opacity: 0 }]}>
      <AppText style={styles.rank}>{row.rank}</AppText><Avatar name={row.name} avatarUrl={row.avatarUrl} size={38} />
      <AppText numberOfLines={1} style={styles.name}>{row.name}</AppText><AppText variant="label">{row.totalCoins.toLocaleString(locale)} coin</AppText>
    </GlassSurface>)}
    </View>
    {data && !rows.length && (data.status === "final" || data.status === "live") ? <AppText muted>{c.empty}</AppText> : null}
    {query.isError ? <Pressable onPress={() => void query.refetch()} style={styles.date}><AppText>{c.retry}</AppText></Pressable> : null}
    {query.hasNextPage ? <Pressable disabled={query.isFetchingNextPage} onPress={loadMore} style={styles.date}>{query.isFetchingNextPage ? <ActivityIndicator /> : <AppText>{c.more}</AppText>}</Pressable> : null}
    <Modal visible={calendar} transparent animationType="fade" onRequestClose={() => setCalendar(false)}>
      <View style={styles.backdrop}><View style={[styles.calendar, { backgroundColor: theme.background }]}>
        <ScreenHeader title={c.calendar} action={<IconButton name="close" label={c.close} onPress={() => setCalendar(false)} />} />
        <View style={styles.controls}><IconButton name="chevron-back" label={`${c.back}: ${c.year}`} onPress={() => setYear(value => Math.max(1970, value - 1))} /><AppText variant="label">{year}</AppText><IconButton name="chevron-forward" label={`${c.next}: ${c.year}`} onPress={() => setYear(value => Math.min(Number((data?.today ?? "9999").slice(0, 4)), value + 1))} /></View>
        <View style={styles.controls}><IconButton name="chevron-back" label={`${c.back}: ${c.month}`} onPress={() => { if (month === 0) { setMonth(11); setYear(value => Math.max(1970, value - 1)); } else setMonth(month - 1); }} /><AppText>{new Date(year, month, 1).toLocaleDateString(locale, { month: "long" })}</AppText><IconButton name="chevron-forward" label={`${c.next}: ${c.month}`} onPress={() => { if (month === 11) { setMonth(0); setYear(value => value + 1); } else setMonth(month + 1); }} /></View>
        <View style={styles.grid}>{Array.from({ length: firstWeekday + monthDays }, (_, index) => {
          const number = index - firstWeekday + 1;
          const value = `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(number).padStart(2, "0")}`;
          const disabled = number <= 0 || !data?.today || value > data.today;
          return <Pressable key={index} disabled={disabled} accessibilityRole="button" accessibilityLabel={number > 0 ? value : undefined} onPress={() => select(value)} style={[styles.day, { opacity: disabled ? 0.3 : 1, backgroundColor: value === selected ? theme.primarySoft : "transparent" }]}><AppText>{number > 0 ? number : ""}</AppText></Pressable>;
        })}</View>
      </View></View>
    </Modal>
  </>;
  return <AppFrame swipesDisabled={calendar} renderScrollContent={contentStyle => <View style={{ flex: 1 }} onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}>
    <Animated.ScrollView contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: Platform.OS !== "web", listener: event => {
      const eventWithScroll = event as { nativeEvent: { contentSize: { height: number }; contentOffset: { y: number }; layoutMeasurement: { height: number } } };
      if (eventWithScroll.nativeEvent.contentSize.height - eventWithScroll.nativeEvent.contentOffset.y - eventWithScroll.nativeEvent.layoutMeasurement.height < 240) loadMore();
    } })}>{page}</Animated.ScrollView>
    {data?.self ? <Animated.View pointerEvents="none" style={{ position: "absolute", left: pageInset, right: pageInset, top: 0, transform: [{ translateY: dockY }] }}>
      <GlassSurface variant="strong" style={[styles.row, { height: 64, borderColor: theme.primary, borderWidth: 1 }]}><AppText style={styles.rank}>{data.self.rank}</AppText><Avatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} size={38} /><AppText numberOfLines={1} style={styles.name}>{currentUser.name}</AppText><AppText variant="label">{data.self.totalCoins.toLocaleString(locale)} coin</AppText></GlassSurface>
    </Animated.View> : null}
  </View>} />;
}
const styles = StyleSheet.create({ header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }, title: { flex: 1, fontSize: 20, lineHeight: 26, fontWeight: "700" }, monthLabel: { textAlign: "center", textTransform: "capitalize", marginBottom: 12, fontSize: 18 }, dates: { flexDirection: "row", justifyContent: "center", gap: 8, paddingBottom: 8 }, dayChip: { width: 48, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" }, date: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, alignItems: "center" }, status: { marginVertical: 12 }, row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 18, marginBottom: 8 }, rank: { width: 28, textAlign: "center" }, name: { flex: 1 }, backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }, calendar: { padding: 16, borderRadius: 24, maxWidth: 440, width: "100%", alignSelf: "center" }, controls: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, grid: { flexDirection: "row", flexWrap: "wrap" }, day: { width: "14.2857%", height: 42, justifyContent: "center", alignItems: "center", borderRadius: 12 } });
