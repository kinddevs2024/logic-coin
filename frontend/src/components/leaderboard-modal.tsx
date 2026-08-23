import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { useGlassBlurTarget } from "@/components/glass-blur-target";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { leaderboardApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import type { LeaderboardEntry, LeaderboardMetric } from "@/types";

const copy = {
  ru: { wealth: "Все", wallet: "Деньги", coins: "Coin", me: "Показать меня", close: "Закрыть", login: "Войти", loginHint: "Войдите, чтобы увидеть рейтинг", empty: "В рейтинге пока никого нет", error: "Не удалось загрузить рейтинг", retry: "Повторить" },
  en: { wealth: "All", wallet: "Money", coins: "Coin", me: "Show me", close: "Close", login: "Sign in", loginHint: "Sign in to view the ranking", empty: "The ranking is empty", error: "Could not load the ranking", retry: "Try again" },
  uz: { wealth: "Barchasi", wallet: "Pul", coins: "Coin", me: "Meni ko‘rsat", close: "Yopish", login: "Kirish", loginHint: "Reytingni ko‘rish uchun kiring", empty: "Reyting hozircha bo‘sh", error: "Reyting yuklanmadi", retry: "Qayta urinish" },
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
  const blurTarget = useGlassBlurTarget();
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
  const meOffset = useRef<number | null>(null);
  const closing = useRef(false);
  const query = useQuery({
    queryKey: ["leaderboard", metric, accessToken],
    queryFn: () => leaderboardApi.get(metric, accessToken!),
    enabled: visible && authenticated,
    staleTime: 30_000,
  });
  const entries = query.data?.entries ?? [];
  const hasMe = entries.some((entry) => entry.isCurrentUser || entry.userId === query.data?.me?.userId);

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
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
  }, [backdrop, reduceMotion, translateY, visible]);

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

  const showMe = () => {
    if (meOffset.current === null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, meOffset.current - 8), animated: true });
  };

  const signIn = () => closeWithAction(() => router.push("/login"));

  const selectMetric = (nextMetric: LeaderboardMetric) => {
    if (nextMetric === metric) return;
    const currentIndex = metrics.indexOf(metric);
    const nextIndex = metrics.indexOf(nextMetric);
    setContentDirection(nextIndex > currentIndex ? 1 : -1);
    meOffset.current = null;

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

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="none" onRequestClose={close}>
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
                  blurMethod: "dimezisBlurViewSdk31Plus" as const,
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
          <GlassSurface intensity={88} variant="strong" style={styles.sheetGlass}>
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
              ) : query.isError ? (
                <View style={styles.state}>
                  <Ionicons name="cloud-offline-outline" size={36} color={String(theme.textMuted)} />
                  <AppText muted style={styles.stateText}>{c.error}</AppText>
                  <Pressable onPress={() => void query.refetch()} style={[styles.stateButton, { backgroundColor: theme.primary }]}>
                    <AppText color="#FFFFFF" variant="label">{c.retry}</AppText>
                  </Pressable>
                </View>
              ) : entries.length ? (
                <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                  {entries.map((entry) => (
                    <View
                      key={`${entry.rank}-${entry.userId}`}
                      onLayout={entry.isCurrentUser ? (event) => { meOffset.current = event.nativeEvent.layout.y; } : undefined}
                      style={[
                        styles.row,
                        entry.isCurrentUser && {
                          backgroundColor: theme.primarySoft,
                          borderColor: theme.glassBorder,
                        },
                      ]}
                    >
                      <AppText style={[styles.rank, { color: entry.rank <= 3 ? "#F5A623" : theme.textMuted }]}>{entry.rank}</AppText>
                      <Avatar name={entry.name} avatarUrl={entry.avatarUrl} size={38} />
                      <AppText style={[styles.name, { color: theme.text }]} numberOfLines={1}>{entry.name}</AppText>
                      <EntryValue entry={entry} metric={metric} />
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.state}>
                  <Ionicons name="podium-outline" size={36} color={String(theme.textMuted)} />
                  <AppText muted style={styles.stateText}>{c.empty}</AppText>
                </View>
              )}

              {authenticated && hasMe ? (
                <Pressable onPress={showMe} style={[styles.meButton, { backgroundColor: theme.primary }]}>
                  <Ionicons name="locate" size={18} color="#FFFFFF" />
                  <AppText color="#FFFFFF" variant="label">{c.me}</AppText>
                </Pressable>
              ) : null}
            </Animated.View>
          </GlassSurface>
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
  content: { flex: 1 },
  list: { flex: 1, marginTop: 10 },
  listContent: { gap: 5, paddingBottom: 6 },
  state: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  stateText: { textAlign: "center" },
  stateButton: { minHeight: 44, minWidth: 130, borderRadius: 15, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  row: { minHeight: 58, borderRadius: 18, borderWidth: 1, borderColor: "transparent", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 9 },
  rank: { width: 24, textAlign: "center", fontSize: 13, lineHeight: 17, fontWeight: "900" },
  name: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 18, fontWeight: "800" },
  combinedValue: { alignItems: "flex-end", gap: 2 },
  valueLine: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  valueText: { fontSize: 12, lineHeight: 15, fontWeight: "900" },
  meButton: { minHeight: 50, borderRadius: 18, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
