import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { ChallengeCard } from "@/components/challenge-card";
import { ChallengeAppRequired } from "@/components/challenge-app-required";
import { ChallengeProgress } from "@/components/challenge-progress";
import { GiftInventoryModal } from "@/components/gift-inventory-modal";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useChallenges } from "@/hooks/use-challenges";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";

const copy = {
  ru: { title: "Челленджи", daily: "Сегодня", complete: "пройдено", earned: "Заработано", empty: "Готовим игры дня", refresh: "Обновить", pool: "Призовой фонд" },
  en: { title: "Challenges", daily: "Today", complete: "complete", earned: "Earned", empty: "Preparing today’s games", refresh: "Refresh", pool: "Prize pool" },
  uz: { title: "Sinovlar", daily: "Bugun", complete: "bajarildi", earned: "Yig‘ildi", empty: "Bugungi o‘yinlar tayyorlanmoqda", refresh: "Yangilash", pool: "Mukofot jamg‘armasi" },
} as const;

export default function ChallengesScreen() {
  const theme = useAppTheme();
  const { language } = useTranslation();
  const router = useRouter();
  const [giftsOpen, setGiftsOpen] = useState(false);
  const { isTablet, isDesktop } = useResponsiveLayout();
  const coinBalance = useAppStore((state) => state.coinBalance);
  const { today, isLoading, refresh, pendingGameKey } = useChallenges();
  const c = copy[language];
  const wide = isTablet || isDesktop;

  return (
    <AppFrame wide desktopNavigationInset contentStyle={styles.page} swipesDisabled={giftsOpen}>
      <View style={styles.header}>
        <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.headerTitle}>{c.title}</AppText>
          <View style={styles.headerActions}>
          <Pressable hitSlop={4} accessibilityRole="button" accessibilityLabel={language === "ru" ? "История челленджей" : language === "uz" ? "Sinovlar tarixi" : "Challenge history"} onPress={() => router.push("/challenge-history" as never)}><GlassSurface variant="strong" style={styles.headerIcon}><Ionicons name="time-outline" size={18} color={String(theme.text)} /></GlassSurface></Pressable>
          <Pressable hitSlop={4} accessibilityRole="button" accessibilityLabel={language === "ru" ? "Мои подарки" : language === "uz" ? "Sovg‘alarim" : "My gifts"} onPress={() => setGiftsOpen(true)}><GlassSurface variant="strong" style={styles.headerIcon}><Ionicons name="gift-outline" size={18} color={String(theme.text)} /></GlassSurface></Pressable>
          <GlassSurface variant="strong" intensity={68} style={styles.coinPill}>
            <Ionicons name="diamond" size={13} color="#F5B800" />
            <AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.coinValue, { color: theme.text }]}>{today?.coins.balance ?? coinBalance}</AppText>
          </GlassSurface>
          </View>
      </View>

      <Animated.View entering={FadeIn.duration(350)}>
        <ChallengeProgress today={today} />
      </Animated.View>

      {Platform.OS === "web" ? <View style={{ marginTop: 16 }}><ChallengeAppRequired /></View> : null}

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
          <Pressable onPress={() => void refresh()} style={[styles.refresh, { backgroundColor: theme.primary }]}>
            <Ionicons name="refresh" size={18} color={String(theme.onPrimary)} />
            <AppText color={String(theme.onPrimary)} variant="label">{c.refresh}</AppText>
          </Pressable>
        </View>
      ) : null}
      <GiftInventoryModal visible={giftsOpen} viewOnly onClose={() => setGiftsOpen(false)} />
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 1180 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 22 },
  headerTitle: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  coinPill: { minHeight: 40, maxWidth: 96, borderRadius: 18, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 4 },
  coinValue: { fontSize: 14, lineHeight: 18, fontWeight: "900", flexShrink: 1 },
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
