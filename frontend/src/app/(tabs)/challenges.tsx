import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { ChallengeCard } from "@/components/challenge-card";
import { ChallengeEmptyState } from "@/components/challenge-empty-state";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenHeader } from "@/components/screen-header";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useChallenges } from "@/hooks/use-challenges";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";

const copy = {
  ru: { title: "Челленджи", subtitle: "Шесть игр. Один общий рейтинг.", daily: "Сегодня", complete: "пройдено", earned: "Заработано", rule: "До 1 000 coin за игру", empty: "Готовим игры дня", refresh: "Обновить", pool: "Призовой фонд" },
  en: { title: "Challenges", subtitle: "Six games. One global ranking.", daily: "Today", complete: "complete", earned: "Earned", rule: "Up to 1,000 coin per game", empty: "Preparing today’s games", refresh: "Refresh", pool: "Prize pool" },
  uz: { title: "Sinovlar", subtitle: "Olti o‘yin. Bitta umumiy reyting.", daily: "Bugun", complete: "bajarildi", earned: "Yig‘ildi", rule: "Har o‘yinda 1 000 coingacha", empty: "Bugungi o‘yinlar tayyorlanmoqda", refresh: "Yangilash", pool: "Mukofot jamg‘armasi" },
} as const;

export default function ChallengesScreen() {
  const theme = useAppTheme();
  const { language } = useTranslation();
  const router = useRouter();
  const { isTablet, isDesktop } = useResponsiveLayout();
  const coinBalance = useAppStore((state) => state.coinBalance);
  const { today, isLoading, refresh, pendingGameKey } = useChallenges();
  const c = copy[language];
  const wide = isTablet || isDesktop;
  const completed = today?.completedCount ?? 0;
  const total = today?.totalCount ?? 0;
  const ratio = total ? completed / total : 0;

  return (
    <AppFrame wide desktopNavigationInset contentStyle={styles.page}>
      <ScreenHeader
        title={c.title}
        subtitle={c.subtitle}
        action={
          <GlassSurface variant="strong" intensity={68} style={styles.coinPill}>
            <Ionicons name="diamond" size={16} color="#F5B800" />
            <AppText style={[styles.coinValue, { color: theme.text }]}>{today?.coins.balance ?? coinBalance}</AppText>
          </GlassSurface>
        }
      />

      <Animated.View entering={FadeIn.duration(350)}>
        <GlassSurface variant="strong" intensity={76} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <AppText style={[styles.eyebrow, { color: theme.primary }]}>{c.daily.toUpperCase()}</AppText>
              <AppText style={[styles.heroTitle, { color: theme.text }]}>{completed} / {total} {c.complete}</AppText>
              <AppText variant="caption" muted>{c.rule}</AppText>
            </View>
            <View style={[styles.scoreOrb, { backgroundColor: theme.primarySoft, borderColor: theme.glassBorder }]}>
              <AppText style={[styles.scoreNumber, { color: theme.primary }]}>{today?.totalCoinsToday ?? 0}</AppText>
              <AppText style={[styles.scoreLabel, { color: theme.primary }]}>{c.earned}</AppText>
            </View>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.primarySoft }]}>
            <View style={[styles.progressFill, { width: `${ratio > 0 ? Math.max(4, ratio * 100) : 0}%`, backgroundColor: theme.primary }]} />
          </View>
          {today?.prizes ? (
            <View style={styles.prizeRow}>
              <Ionicons name="trophy-outline" size={17} color="#F5A623" />
              <AppText variant="caption" muted>{c.pool}</AppText>
              <AppText variant="label">{today.prizes.poolUnits} LC</AppText>
            </View>
          ) : null}
        </GlassSurface>
      </Animated.View>

      {isLoading ? (
        <View style={styles.loading}><ActivityIndicator color={String(theme.primary)} /><AppText muted>{c.empty}</AppText></View>
      ) : (
        <View style={[styles.grid, wide && styles.gridWide]}>
          {(today?.games ?? []).map((game, index) => (
            <View key={game.key} style={[styles.cell, wide && styles.cellWide]}>
              <ChallengeCard
                game={game}
                state={game.state}
                index={index}
                loading={pendingGameKey === game.key}
                onPress={() => router.push({ pathname: "/play/[gameKey]", params: { gameKey: game.key, mode: "challenge" } } as never)}
              />
            </View>
          ))}
        </View>
      )}

      {!isLoading && !today?.games.length ? (
        <View style={styles.emptyBlock}>
          <ChallengeEmptyState />
          <Pressable onPress={() => void refresh()} style={[styles.refresh, { backgroundColor: theme.primary }]}>
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <AppText color="#FFFFFF" variant="label">{c.refresh}</AppText>
          </Pressable>
        </View>
      ) : null}
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 1180 },
  coinPill: { minHeight: 46, borderRadius: 18, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 6 },
  coinValue: { fontSize: 15, lineHeight: 19, fontWeight: "900" },
  hero: { borderRadius: 30, padding: 18, gap: 15, overflow: "hidden" },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  eyebrow: { fontSize: 10, lineHeight: 13, fontWeight: "900", letterSpacing: 1.4 },
  heroTitle: { marginTop: 2, fontSize: 24, lineHeight: 30, fontWeight: "900" },
  scoreOrb: { minWidth: 92, minHeight: 76, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  scoreNumber: { fontSize: 20, lineHeight: 25, fontWeight: "900" },
  scoreLabel: { fontSize: 9, lineHeight: 12, fontWeight: "800", textTransform: "uppercase" },
  progressTrack: { height: 8, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  prizeRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  grid: { gap: 11, marginTop: 16 },
  gridWide: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "100%" },
  cellWide: { width: "49%", flexGrow: 1, minWidth: 330 },
  loading: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyBlock: { marginTop: 16, gap: 12 },
  refresh: { alignSelf: "center", marginTop: 18, minHeight: 50, borderRadius: 18, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 8 },
});
