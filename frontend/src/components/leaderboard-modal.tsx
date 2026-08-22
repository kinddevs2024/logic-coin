import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInUp, FadeOut } from "react-native-reanimated";

import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { leaderboardApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import type { LeaderboardMetric } from "@/types";

const copy = {
  ru: { title: "Рейтинг", wallet: "Баланс", coins: "Coins", lifetime: "За всё время", me: "Показать меня", close: "Закрыть", login: "Войти", loginHint: "Войдите, чтобы увидеть рейтинг", empty: "В рейтинге пока никого нет", error: "Не удалось загрузить рейтинг", retry: "Повторить" },
  en: { title: "Ranking", wallet: "Balance", coins: "Coins", lifetime: "All time", me: "Show me", close: "Close", login: "Sign in", loginHint: "Sign in to view the ranking", empty: "The ranking is empty", error: "Could not load the ranking", retry: "Try again" },
  uz: { title: "Reyting", wallet: "Balans", coins: "Coins", lifetime: "Barcha vaqt", me: "Meni ko‘rsat", close: "Yopish", login: "Kirish", loginHint: "Reytingni ko‘rish uchun kiring", empty: "Reyting hozircha bo‘sh", error: "Reyting yuklanmadi", retry: "Qayta urinish" },
} as const;

export function LeaderboardModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  const router = useRouter();
  const { language } = useTranslation();
  const c = copy[language];
  const accessToken = useAppStore((state) => state.accessToken);
  const authMode = useAppStore((state) => state.authMode);
  const authenticated = authMode === "authenticated" && Boolean(accessToken);
  const [metric, setMetric] = useState<LeaderboardMetric>("coins");
  const scrollRef = useRef<ScrollView>(null);
  const meOffset = useRef<number | null>(null);
  const query = useQuery({
    queryKey: ["leaderboard", metric, accessToken],
    queryFn: () => leaderboardApi.get(metric, accessToken!),
    enabled: visible && authenticated,
    staleTime: 30_000,
  });
  const entries = query.data?.entries ?? [];
  const hasMe = entries.some((entry) => entry.isCurrentUser || entry.userId === query.data?.me?.userId);

  const showMe = () => {
    if (meOffset.current === null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, meOffset.current - 8), animated: true });
  };

  const signIn = () => {
    onClose();
    router.push("/login");
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel={c.close} onPress={onClose} style={StyleSheet.absoluteFill} />
        <Animated.View entering={FadeInUp.springify().damping(20)} style={styles.wrap}>
          <GlassSurface intensity={88} variant="strong" style={styles.modal}>
            <View style={styles.header}>
              <View style={[styles.trophy, { backgroundColor: theme.primarySoft }]}><Ionicons name="trophy" size={20} color={String(theme.primary)} /></View>
              <AppText style={[styles.title, { color: theme.text }]}>{c.title}</AppText>
              <Pressable onPress={onClose} style={[styles.close, { backgroundColor: theme.primarySoft }]}><Ionicons name="close" size={19} color={String(theme.text)} /></Pressable>
            </View>
            <View style={[styles.filters, { backgroundColor: theme.primarySoft }]}>
              {(["wallet", "coins", "lifetime"] as const).map((key) => (
                <Pressable key={key} onPress={() => setMetric(key)} style={[styles.filter, metric === key && { backgroundColor: theme.surfaceRaised }]}>
                  <AppText style={[styles.filterText, { color: metric === key ? theme.text : theme.textMuted }]}>{c[key]}</AppText>
                </Pressable>
              ))}
            </View>
            {!authenticated ? (
              <View style={styles.state}><Ionicons name="person-circle-outline" size={38} color={String(theme.primary)} /><AppText muted style={styles.stateText}>{c.loginHint}</AppText><Pressable onPress={signIn} style={[styles.stateButton, { backgroundColor: theme.primary }]}><AppText color="#FFFFFF" variant="label">{c.login}</AppText></Pressable></View>
            ) : query.isLoading ? (
              <View style={styles.state}><ActivityIndicator color={String(theme.primary)} /></View>
            ) : query.isError ? (
              <View style={styles.state}><Ionicons name="cloud-offline-outline" size={36} color={String(theme.textMuted)} /><AppText muted style={styles.stateText}>{c.error}</AppText><Pressable onPress={() => void query.refetch()} style={[styles.stateButton, { backgroundColor: theme.primary }]}><AppText color="#FFFFFF" variant="label">{c.retry}</AppText></Pressable></View>
            ) : entries.length ? (
              <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                {entries.map((entry) => (
                  <View key={`${entry.rank}-${entry.userId}`} onLayout={entry.isCurrentUser ? (event) => { meOffset.current = event.nativeEvent.layout.y; } : undefined} style={[styles.row, entry.isCurrentUser && { backgroundColor: theme.primarySoft, borderColor: theme.glassBorder }]}> 
                    <AppText style={[styles.rank, { color: entry.rank <= 3 ? "#F5A623" : theme.textMuted }]}>{entry.rank}</AppText>
                    <Avatar name={entry.name} avatarUrl={entry.avatarUrl} size={38} />
                    <AppText style={[styles.name, { color: theme.text }]} numberOfLines={1}>{entry.name}</AppText>
                    <View style={styles.value}>
                      {metric === "coins" ? <Ionicons name="diamond" size={13} color="#F5B800" /> : null}
                      <AppText style={[styles.valueText, { color: theme.text }]}>{metric === "coins" ? entry.value : formatMoney(entry.value)}</AppText>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : <View style={styles.state}><Ionicons name="podium-outline" size={36} color={String(theme.textMuted)} /><AppText muted style={styles.stateText}>{c.empty}</AppText></View>}
            {authenticated && hasMe ? <Pressable onPress={showMe} style={[styles.meButton, { backgroundColor: theme.primary }]}><Ionicons name="locate" size={18} color="#FFFFFF" /><AppText color="#FFFFFF" variant="label">{c.me}</AppText></Pressable> : null}
          </GlassSurface>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(4,16,38,0.38)", alignItems: "center", justifyContent: "center", padding: 18 },
  wrap: { width: "100%", maxWidth: 520, maxHeight: "82%" },
  modal: { borderRadius: 34, padding: 16, overflow: "hidden" },
  header: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 },
  trophy: { width: 40, height: 40, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: "900" },
  close: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  filters: { marginTop: 12, borderRadius: 18, padding: 4, flexDirection: "row" },
  filter: { flex: 1, minHeight: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  filterText: { fontSize: 11, lineHeight: 14, fontWeight: "800" },
  list: { marginTop: 10, maxHeight: 430 },
  listContent: { gap: 5, paddingBottom: 6 },
  state: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  stateText: { textAlign: "center" },
  stateButton: { minHeight: 44, minWidth: 130, borderRadius: 15, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  row: { minHeight: 54, borderRadius: 17, borderWidth: 1, borderColor: "transparent", paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 9 },
  rank: { width: 24, textAlign: "center", fontSize: 13, lineHeight: 17, fontWeight: "900" },
  name: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: "800" },
  value: { flexDirection: "row", alignItems: "center", gap: 4 },
  valueText: { fontSize: 12, lineHeight: 15, fontWeight: "900" },
  meButton: { minHeight: 50, borderRadius: 18, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
