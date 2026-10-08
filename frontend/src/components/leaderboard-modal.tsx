import Ionicons from "@expo/vector-icons/Ionicons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { CountryFlagBadge } from "@/components/country-flag";
import { useModalBlurTarget } from "@/components/glass-blur-target";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { leaderboardApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { shouldLoadLeaderboardPage } from "@/lib/leaderboard-pagination";
import { getSelfDock, type SelfDock } from "@/lib/leaderboard-dock";
import { useAppStore } from "@/store/app-store";
import type { LeaderboardEntry, LeaderboardMetric } from "@/types";

const copy = {
  ru: { wealth: "Все", wallet: "Деньги", coins: "Coin", me: "Мой аккаунт", close: "Закрыть", login: "Войти", loginHint: "Войдите, чтобы увидеть рейтинг", empty: "В рейтинге пока никого нет", error: "Не удалось загрузить рейтинг", retry: "Повторить", more: "Загружаем ещё…" },
  en: { wealth: "All", wallet: "Money", coins: "Coin", me: "My account", close: "Close", login: "Sign in", loginHint: "Sign in to view the ranking", empty: "The ranking is empty", error: "Could not load the ranking", retry: "Try again", more: "Loading more…" },
  uz: { wealth: "Barchasi", wallet: "Pul", coins: "Coin", me: "Mening akkauntim", close: "Yopish", login: "Kirish", loginHint: "Reytingni ko‘rish uchun kiring", empty: "Reyting hozircha bo‘sh", error: "Reyting yuklanmadi", retry: "Qayta urinish", more: "Yana yuklanmoqda…" },
} as const;

const metrics: LeaderboardMetric[] = ["wealth", "wallet", "coins"];

function EntryValue({ entry, metric }: { entry: LeaderboardEntry; metric: LeaderboardMetric }) {
  if (metric === "wealth") {
    return (
      <View style={styles.combinedValue}>
        <View style={styles.valueLine}>
          <Ionicons name="wallet-outline" size={13} color="#1183F7" />
          <AppText style={styles.valueText}>{formatMoney(entry.walletBalanceUnits)}</AppText>
        </View>
        <View style={styles.valueLine}>
          <Ionicons name="diamond" size={13} color="#F5B800" />
          <AppText style={styles.valueText}>{entry.coinBalance}</AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.valueLine}>
      <Ionicons
        name={metric === "coins" ? "diamond" : "wallet-outline"}
        size={14}
        color={metric === "coins" ? "#F5B800" : "#1183F7"}
      />
      <AppText style={styles.valueText}>
        {metric === "coins" ? entry.coinBalance : formatMoney(entry.walletBalanceUnits)}
      </AppText>
    </View>
  );
}

export function LeaderboardModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  const blurTarget = useModalBlurTarget();
  const router = useRouter();
  const { language } = useTranslation();
  const c = copy[language];
  const reduceMotion = useReducedMotion();
  const accessToken = useAppStore((state) => state.accessToken);
  const authMode = useAppStore((state) => state.authMode);
  const authenticated = authMode === "authenticated" && Boolean(accessToken);
  const [metric, setMetric] = useState<LeaderboardMetric>("wealth");
  const [filtersWidth, setFiltersWidth] = useState(0);
  const [contentDirection, setContentDirection] = useState(1);
  const [translateY] = useState(() => new Animated.Value(900));
  const [backdrop] = useState(() => new Animated.Value(0));
  const [activeFilter] = useState(() => new Animated.Value(0));
  const [contentProgress] = useState(() => new Animated.Value(1));
  const scrollRef = useRef<ScrollView>(null);
  const meOffset = useRef<{ y: number; height: number } | null>(null);
  const scrollY = useRef(0);
  const [nativeScrollY] = useState(() => new Animated.Value(0));
  const [nativeSelfLayout, setNativeSelfLayout] = useState<{ y: number; height: number } | null>(null);
  const [nativeViewportHeight, setNativeViewportHeight] = useState(0);
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);
  const touchY = useRef<number | null>(null);
  const nextPageInFlight = useRef(false);
  const paginationRegion = useRef<View>(null);
  const closing = useRef(false);
  const [selfDock, setSelfDock] = useState<SelfDock>("bottom");
  const pageSize = 10;
  const query = useInfiniteQuery({
    queryKey: ["leaderboard", accessToken],
    queryFn: ({ pageParam, signal }) => leaderboardApi.getPage(pageParam, pageSize, accessToken!, signal),
    enabled: visible && authenticated,
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.offset + lastPage.limit < lastPage.total
        ? lastPage.offset + lastPage.limit
        : undefined,
    staleTime: 60_000,
    refetchOnMount: false,
  });
  const pages = query.data?.pages ?? [];
  const selectedBoard = pages[0]?.leaderboards[metric];
  const entries = pages.flatMap((page) => page.leaderboards[metric].entries);
  const self = selectedBoard?.me ?? null;

  const requestNextPage = useCallback((
    offset = scrollY.current,
    height = viewportHeight.current,
    content = contentHeight.current,
  ) => {
    if (!visible || !authenticated || nextPageInFlight.current || !shouldLoadLeaderboardPage({
      offset, viewportHeight: height, contentHeight: content,
      hasNextPage: Boolean(query.hasNextPage), fetching: query.isFetching,
    })) return;
    nextPageInFlight.current = true;
    void query.fetchNextPage({ cancelRefetch: false }).finally(() => {
      nextPageInFlight.current = false;
    });
  }, [visible, authenticated, query.hasNextPage, query.isFetching, query.fetchNextPage]);

  useEffect(() => {
    if (Platform.OS !== "web" || !visible || !authenticated || !entries.length) return;
    const region = paginationRegion.current as unknown as HTMLElement | null;
    const scroller = scrollRef.current?.getScrollableNode() as HTMLElement | undefined;
    if (!region || !scroller) return;
    const loadFromGesture = () => requestNextPage(scroller.scrollTop, scroller.clientHeight, scroller.scrollHeight);
    // onScroll alone never fires when the first page fits entirely.
    const onWheel = (event: WheelEvent) => { if (event.deltaY > 0) loadFromGesture(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.shiftKey && ["ArrowDown", "PageDown", "End", " "].includes(event.key)) loadFromGesture();
    };
    region.addEventListener("wheel", onWheel, { passive: true });
    region.addEventListener("keydown", onKeyDown);
    return () => {
      region.removeEventListener("wheel", onWheel);
      region.removeEventListener("keydown", onKeyDown);
    };
  }, [visible, authenticated, entries.length, requestNextPage]);

  const updateSelfVisibility = (offset: number, height: number) => {
    if (Platform.OS !== "web") return;
    setSelfDock(self ? getSelfDock(meOffset.current, offset, height) : null);
  };

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    scrollY.current = 0;
    nativeScrollY.setValue(0);
    translateY.setValue(900);
    backdrop.setValue(0);
    const entrance = reduceMotion
      ? Animated.timing(translateY, {
          toValue: 0,
          duration: 0,
          useNativeDriver: Platform.OS !== "web",
        })
      : Animated.spring(translateY, {
          toValue: 0,
          damping: 22,
          stiffness: 190,
          mass: 0.9,
          useNativeDriver: Platform.OS !== "web",
        });
    Animated.parallel([
      entrance,
      Animated.timing(backdrop, {
        toValue: 1,
        duration: reduceMotion ? 0 : 210,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [backdrop, nativeScrollY, reduceMotion, translateY, visible]);

  const closeWithAction = (afterClose?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 900,
        duration: reduceMotion ? 0 : 210,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(backdrop, {
        toValue: 0,
        duration: reduceMotion ? 0 : 190,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
        afterClose?.();
      } else {
        closing.current = false;
      }
    });
  };

  const close = () => closeWithAction();

  const signIn = () => closeWithAction(() => router.push("/login"));

  const selectMetric = (nextMetric: LeaderboardMetric) => {
    if (nextMetric === metric) return;
    const currentIndex = metrics.indexOf(metric);
    const nextIndex = metrics.indexOf(nextMetric);
    setContentDirection(nextIndex > currentIndex ? 1 : -1);
    meOffset.current = null;
    setNativeSelfLayout(null);
    nativeScrollY.setValue(0);
    setSelfDock("bottom");
    scrollY.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });

    Animated.spring(activeFilter, {
      toValue: nextIndex,
      damping: 22,
      stiffness: 220,
      mass: 0.72,
      useNativeDriver: Platform.OS !== "web",
    }).start();
    contentProgress.setValue(0);
    setMetric(nextMetric);
    Animated.timing(contentProgress, {
      toValue: 1,
      duration: reduceMotion ? 0 : 220,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };

  const filterCellWidth = Math.max(0, (filtersWidth - 8) / metrics.length);
  const contentTranslateX = contentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [contentDirection * 14, 0],
  });
  const nativeDockTravel = Math.max(1, nativeViewportHeight - (nativeSelfLayout?.height ?? 58));
  const nativeDockY = Animated.subtract(nativeSelfLayout?.y ?? 0, nativeScrollY).interpolate({
    inputRange: [0, nativeDockTravel],
    outputRange: [0, nativeDockTravel],
    extrapolate: "clamp",
  });

  const edgeOpacity = nativeScrollY.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: "clamp" });
  const edgeSolid = theme.mode === "dark" ? "#19273E" : "#FFFFFF";
  const edgeClear = theme.mode === "dark" ? "rgba(25,39,62,0)" : "rgba(255,255,255,0)";
  if (!visible) return null;

  return (
    <Modal transparent visible={visible} statusBarTranslucent hardwareAccelerated={Platform.OS === "android"} animationType="none" onRequestClose={close}>
      <View style={styles.modalRoot}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(4,16,38,0.32)", opacity: backdrop },
          ]}
        >
          <BlurView
            pointerEvents="none"
            intensity={34}
            tint={theme.mode === "dark" ? "dark" : "light"}
            {...(Platform.OS === "android" && blurTarget
              ? {
                  blurMethod: "dimezisBlurView" as const,
                  blurTarget,
                }
              : {})}
            style={StyleSheet.absoluteFill}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={c.close} style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY }], shadowColor: "#000000" },
          ]}
        >
          <View style={[styles.sheetGlass, { backgroundColor: edgeSolid }]}>
            <AppText accessibilityRole="header" style={{ fontSize: 16, fontWeight: "800", textAlign: "center", paddingBottom: 10 }}>{language === "uz" ? "Umumiy natijalar reytingi" : language === "ru" ? "Рейтинг общих результатов" : "Overall results ranking"}</AppText>
            <View
              onLayout={(event) => setFiltersWidth(event.nativeEvent.layout.width)}
              style={[styles.filters, { backgroundColor: theme.primarySoft }]}
            >
              {filterCellWidth > 0 ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.activeFilter,
                    {
                      width: filterCellWidth,
                      backgroundColor: theme.surfaceRaised,
                      borderColor: theme.glassBorder,
                      transform: [
                        {
                          translateX: activeFilter.interpolate({
                            inputRange: [0, 1, 2],
                            outputRange: [0, filterCellWidth, filterCellWidth * 2],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ) : null}
              {metrics.map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: metric === key }}
                  onPress={() => selectMetric(key)}
                  style={styles.filter}
                >
                  <Ionicons
                    name={key === "wealth" ? "layers-outline" : key === "wallet" ? "wallet-outline" : "diamond-outline"}
                    size={16}
                    color={String(metric === key ? theme.primary : theme.textMuted)}
                  />
                  <AppText style={[styles.filterText, { color: metric === key ? theme.text : theme.textMuted }]}>{c[key]}</AppText>
                </Pressable>
              ))}
            </View>

            <Animated.View
              ref={paginationRegion}
              onTouchStart={(event) => { touchY.current = event.nativeEvent.pageY; }}
              onTouchMove={(event) => {
                const nextY = event.nativeEvent.pageY;
                if (touchY.current !== null && touchY.current - nextY > 4) requestNextPage();
                touchY.current = nextY;
              }}
              onTouchEnd={() => { touchY.current = null; }}
              style={[
                styles.content,
                { opacity: contentProgress, transform: [{ translateX: contentTranslateX }] },
              ]}
            >
              {!authenticated ? (
                <View style={styles.state}>
                  <Ionicons name="person-circle-outline" size={38} color={String(theme.primary)} />
                  <AppText muted style={styles.stateText}>{c.loginHint}</AppText>
                  <Pressable onPress={signIn} style={[styles.stateButton, { backgroundColor: theme.primary }]}>
                    <AppText color="#FFFFFF" variant="label">{c.login}</AppText>
                  </Pressable>
                </View>
              ) : query.isLoading ? (
                <View style={styles.state}><ActivityIndicator color={String(theme.primary)} /></View>
              ) : query.isError && !entries.length ? (
                <View style={styles.state}>
                  <Ionicons name="cloud-offline-outline" size={36} color={String(theme.textMuted)} />
                  <AppText muted style={styles.stateText}>{c.error}</AppText>
                  <Pressable onPress={() => void query.refetch()} style={[styles.stateButton, { backgroundColor: theme.primary }]}>
                    <AppText color="#FFFFFF" variant="label">{c.retry}</AppText>
                  </Pressable>
                </View>
              ) : entries.length ? (
                <Animated.ScrollView
                  ref={scrollRef}
                  testID="leaderboard-scroll"
                  onContentSizeChange={(_width, height) => { contentHeight.current = height; }}
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onLayout={(event) => {
                    viewportHeight.current = event.nativeEvent.layout.height;
                    setNativeViewportHeight(event.nativeEvent.layout.height);
                    updateSelfVisibility(scrollY.current, viewportHeight.current);
                  }}
                  onScroll={
                    // Animated.event registers the listener; refs below are read only on scroll.
                    // eslint-disable-next-line react-hooks/refs
                    Animated.event([{ nativeEvent: { contentOffset: { y: nativeScrollY } } }], {
                    useNativeDriver: Platform.OS !== "web",
                    listener: (event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
                    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                    const movingDown = contentOffset.y > scrollY.current;
                    scrollY.current = contentOffset.y;
                    viewportHeight.current = layoutMeasurement.height;
                    updateSelfVisibility(contentOffset.y, layoutMeasurement.height);
                    if (movingDown) requestNextPage(contentOffset.y, layoutMeasurement.height, contentSize.height);
                    },
                  })}
                >
                  {entries.map((entry) => (
                    <View
                      key={`${metric}-${entry.rank}-${entry.userId}`}
                      onLayout={entry.isCurrentUser ? (event) => {
                        meOffset.current = event.nativeEvent.layout;
                        setNativeSelfLayout({ y: event.nativeEvent.layout.y, height: event.nativeEvent.layout.height });
                        updateSelfVisibility(scrollY.current, viewportHeight.current);
                      } : undefined}
                      style={[
                        styles.row,
                        entry.isCurrentUser && {
                          backgroundColor: theme.primarySoft,
                          borderColor: theme.glassBorder,
                          opacity: selfDock ? 0 : 1,
                        },
                      ]}
                    >
                      <AppText style={[styles.rank, { color: entry.rank <= 3 ? "#F5A623" : theme.textMuted }]}>{entry.rank}</AppText>
                      <Avatar name={entry.name} avatarUrl={entry.avatarUrl} size={38} />
                      <View style={styles.nameBlock}>
                        <AppText style={[styles.name, { color: theme.text }]} numberOfLines={1}>{entry.isCurrentUser ? `${language === "ru" ? "Я" : language === "uz" ? "Men" : "Me"}: ` : ""}{entry.name}</AppText>
                        {entry.countryCode ? <CountryFlagBadge countryCode={entry.countryCode} size={15} /> : null}
                      </View>
                      <EntryValue entry={entry} metric={metric} />
                    </View>
                  ))}
                  {query.isFetchNextPageError ? (
                    <Pressable accessibilityRole="button" onPress={() => requestNextPage()} style={styles.moreLoading}>
                      <AppText muted>{c.error} · {c.retry}</AppText>
                    </Pressable>
                  ) : null}
                  {query.isFetchingNextPage ? (
                    <View style={styles.moreLoading}><ActivityIndicator size="small" color={String(theme.primary)} /><AppText muted style={styles.moreText}>{c.more}</AppText></View>
                  ) : null}
                </Animated.ScrollView>
              ) : (
                <View style={styles.state}>
                  <Ionicons name="podium-outline" size={36} color={String(theme.textMuted)} />
                  <AppText muted style={styles.stateText}>{c.empty}</AppText>
                </View>
              )}

              {authenticated && entries.length ? <>
                <Animated.View pointerEvents="none" style={[styles.fadeTop, { opacity: edgeOpacity }]}><LinearGradient colors={[edgeSolid, edgeSolid, edgeClear]} locations={[0, 0.18, 1]} style={StyleSheet.absoluteFill} /></Animated.View>
                <LinearGradient pointerEvents="none" colors={[edgeClear, edgeSolid, edgeSolid]} locations={[0, 0.7, 1]} style={styles.fadeBottom} />
              </> : null}
              {authenticated && self && selfDock ? (
                <Animated.View pointerEvents="none" style={[styles.meDock,
                  Platform.OS !== "web" && nativeSelfLayout
                    ? { top: 0, transform: [{ translateY: nativeDockY }] }
                    : selfDock === "top" ? { top: 10 } : { bottom: 0 },
                  { backgroundColor: "transparent" }]}>
                  <View style={[styles.row, styles.meRow, { backgroundColor: theme.primarySoft, borderColor: "transparent" }, Platform.OS !== "web" && nativeSelfLayout ? { minHeight: nativeSelfLayout.height } : null]}>
                    <AppText style={[styles.rank, { color: theme.textMuted }]}>{self.rank}</AppText>
                    <Avatar name={self.name} avatarUrl={self.avatarUrl} size={38} />
                    <View style={styles.nameBlock}><AppText style={[styles.name, { color: theme.text }]} numberOfLines={1}>{language === "ru" ? "Я" : language === "uz" ? "Men" : "Me"}: {self.name}</AppText>{self.countryCode ? <CountryFlagBadge countryCode={self.countryCode} size={15} /> : null}</View>
                    <EntryValue entry={self} metric={metric} />
                  </View>
                </Animated.View>
              ) : null}
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    width: "100%",
    maxWidth: 720,
    height: "78%",
    maxHeight: 720,
    alignSelf: "center",
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -8 },
    elevation: 22,
  },
  sheetGlass: {
    flex: 1,
    borderRadius: 0,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    overflow: "hidden",
  },
  filters: { borderRadius: 21, padding: 4, flexDirection: "row", overflow: "hidden" },
  activeFilter: {
    position: "absolute",
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 17,
    borderWidth: 1,
    shadowColor: "#157DFB",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  filter: {
    flex: 1,
    minHeight: 44,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 6,
    zIndex: 1,
  },
  filterText: { fontSize: 12, lineHeight: 15, fontWeight: "800" },
  content: { flex: 1, minHeight: 0 },
  fadeTop: { position: "absolute", top: -3, left: 0, right: 0, height: 52 },
  fadeBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 110 },
  list: { flex: 1, minHeight: 0 },
  listContent: { gap: 5, paddingTop: 10, paddingBottom: 6 },
  state: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  stateText: { textAlign: "center" },
  stateButton: { minHeight: 44, minWidth: 130, borderRadius: 15, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  row: { minHeight: 58, borderRadius: 18, borderWidth: 1, borderColor: "transparent", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 9 },
  rank: { width: 24, textAlign: "center", fontSize: 13, lineHeight: 17, fontWeight: "900" },
  nameBlock: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 18, fontWeight: "800" },
  combinedValue: { alignItems: "flex-end", gap: 2 },
  valueLine: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  valueText: { fontSize: 12, lineHeight: 15, fontWeight: "900" },
  moreLoading: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  moreText: { fontSize: 12, fontWeight: "700" },
  meDock: { position: "absolute", left: 0, right: 0, borderRadius: 18, zIndex: 2 },
  meRow: { minHeight: 54 },
});
