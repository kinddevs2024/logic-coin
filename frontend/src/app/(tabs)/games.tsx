import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { GameEconomyModal } from "@/components/game-economy";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenHeader } from "@/components/screen-header";
import { gameCoverFor } from "@/constants/game-covers";
import { GAME_BY_KEY, GAME_CATALOG, localizeGame, type LocalizedGame } from "@/constants/games";
import { EMPTY_GAME_PROGRESS, type GameId, useGameProgressStore } from "@/games/progress-store";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useClientReady } from "@/hooks/use-client-ready";
import { useGameProgressSync } from "@/hooks/use-game-progress-sync";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTranslation } from "@/hooks/use-translation";
import { gamesApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import type { GameCatalogItem } from "@/types";

const copy = {
  ru: { title: "Игры", best: "Монеты", play: "Играть" },
  en: { title: "Games", best: "Coins", play: "Play" },
  uz: { title: "O‘yinlar", best: "Tangalar", play: "O‘ynash" },
} as const;

const CATALOG_KEY_BY_SERVER_KEY: Readonly<Record<string, string>> = {
  "color-focus": "tsvet",
  "color-stroop": "tsvet",
  "reflex-hit": "udar",
  strike: "udar",
  "find-number": "space-find-number",
  "geo-master": "geography-quiz",
  "shadow-match": "shadow",
};

const PROGRESS_KEY_BY_SERVER_KEY: Partial<Record<string, GameId>> = {
  "color-focus": "tsvet",
  "color-stroop": "tsvet",
  "reflex-hit": "udar",
  strike: "udar",
  "find-number": "space-find-number",
  "geo-master": "geography-quiz",
  "shadow-match": "shadow",
};

function mapServerGame(entry: GameCatalogItem): LocalizedGame | null {
  const catalog = GAME_BY_KEY[CATALOG_KEY_BY_SERVER_KEY[entry.key] ?? entry.key];
  if (!catalog) return null;
  return {
    ...catalog,
    id: entry.id,
    key: entry.key,
    slug: entry.slug,
    challengeEnabled: entry.challengeEnabled,
    practiceEnabled: entry.practiceEnabled,
  };
}

export default function GamesScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { language } = useTranslation();
  const { isTablet, isDesktop } = useResponsiveLayout();
  const accessToken = useAppStore((state) => state.accessToken);
  const authMode = useAppStore((state) => state.authMode);
  const progress = useGameProgressStore((state) => state.games);
  const coinBalance = useAppStore((state) => state.coinBalance);
  const ready = useClientReady();
  const [economyGameId, setEconomyGameId] = useState<GameId | null>(null);
  useGameProgressSync();
  const c = copy[language];
  const wide = isTablet || isDesktop;
  const query = useQuery({
    queryKey: ["games", accessToken],
    queryFn: () => gamesApi.list(accessToken!),
    enabled: authMode === "authenticated" && Boolean(accessToken),
    staleTime: 60_000,
  });
  const authenticated = authMode === "authenticated" && Boolean(accessToken);
  const games = authenticated && query.isSuccess
    ? query.data
        .filter((entry) => entry.practiceEnabled)
        .map(mapServerGame)
        .filter((entry): entry is LocalizedGame => entry !== null)
    : GAME_CATALOG;

  return (
    <AppFrame wide desktopNavigationInset contentStyle={styles.page}>
      <ScreenHeader
        title={c.title}
        action={
          <GlassSurface intensity={64} variant="strong" style={styles.count}>
            <Ionicons name="diamond" size={18} color={String(theme.primary)} />
            <AppText style={[styles.countText, { color: theme.primary }]}>{coinBalance} coin</AppText>
          </GlassSurface>
        }
      />
      <View style={[styles.grid, wide && styles.gridWide]}>
        {games.map((entry, index) => {
          const game = localizeGame(entry, language);
          const progressKey = PROGRESS_KEY_BY_SERVER_KEY[game.key] ?? (game.key as GameId);
          const saved = ready ? progress[progressKey] ?? EMPTY_GAME_PROGRESS : EMPTY_GAME_PROGRESS;
          const cover = gameCoverFor(game.key);
          return (
            <Animated.View key={game.key} entering={FadeInDown.delay(Math.min(index, 12) * 35).duration(380)} style={[styles.cell, wide && styles.cellWide]}>
              <GlassSurface intensity={68} variant="strong" style={styles.card}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${c.play}: ${game.title}`} onPress={() => router.push({ pathname: "/play/[gameKey]", params: { gameKey: game.key, mode: "practice" } } as never)} style={({ pressed }) => [styles.playArea, pressed && styles.pressed]}>
                  <View style={[styles.icon, { backgroundColor: `${game.color}18`, borderColor: `${game.color}38` }]}>
                    {cover ? <Image source={cover} resizeMode="cover" style={styles.cover} accessibilityIgnoresInvertColors /> : <Ionicons name={game.icon as React.ComponentProps<typeof Ionicons>["name"]} color={game.color} size={28} />}
                  </View>
                  <View style={styles.copy}>
                    <AppText style={[styles.title, { color: theme.text }]} numberOfLines={1}>{game.title}</AppText>
                    <AppText style={[styles.caption, { color: theme.textMuted }]} numberOfLines={1}>{game.description}</AppText>
                    <View style={styles.bestRow}>
                      <Ionicons name="diamond-outline" size={13} color={game.color} />
                      <AppText style={[styles.best, { color: game.color }]}>{c.best} {Math.min(1000, saved.coins)}</AppText>
                    </View>
                  </View>
                </Pressable>
                <View style={styles.cardActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Скины: ${game.title}`} onPress={() => setEconomyGameId(progressKey)} style={({ pressed }) => [styles.skinButton, { borderColor: `${game.color}42`, backgroundColor: `${game.color}13` }, pressed && styles.pressed]}>
                    <Ionicons name="shirt-outline" color={game.color} size={17} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${c.play}: ${game.title}`} onPress={() => router.push({ pathname: "/play/[gameKey]", params: { gameKey: game.key, mode: "practice" } } as never)} style={({ pressed }) => [styles.playButton, { backgroundColor: game.color }, pressed && styles.pressed]}>
                    <Ionicons name="play" color="#FFFFFF" size={15} />
                    <AppText style={styles.playText}>{c.play}</AppText>
                  </Pressable>
                </View>
              </GlassSurface>
            </Animated.View>
          );
        })}
      </View>
      {economyGameId ? <GameEconomyModal gameId={economyGameId} visible onClose={() => setEconomyGameId(null)} /> : null}
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 1180 },
  count: { minHeight: 46, borderRadius: 18, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  countText: { fontSize: 12, lineHeight: 15, fontWeight: "900" },
  grid: { gap: 11 },
  gridWide: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "100%" },
  cellWide: { width: "49%", minWidth: 330, flexGrow: 1 },
  playArea: { flex: 1, minWidth: 0, alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: 13, borderRadius: 22 },
  pressed: { opacity: 0.87, transform: [{ scale: 0.99 }] },
  card: { minHeight: 106, borderRadius: 28, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, overflow: "hidden" },
  icon: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cover: { width: "100%", height: "100%", borderRadius: 31 },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "900" },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
  bestRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  best: { fontSize: 10, lineHeight: 13, fontWeight: "900" },
  cardActions: { alignItems: "center", gap: 7 },
  skinButton: { width: 34, height: 34, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  playButton: { minWidth: 82, minHeight: 42, borderRadius: 21, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  playText: { color: "#FFFFFF", fontSize: 11, lineHeight: 14, fontWeight: "900" },
});
