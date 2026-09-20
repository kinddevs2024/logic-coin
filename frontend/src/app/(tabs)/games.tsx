import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, Image, Platform, Pressable, StyleSheet, View, type ListRenderItemInfo, type StyleProp, type ViewStyle } from "react-native";

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
import { androidImageProps } from "@/lib/android-image";
import { accentForeground, readableAccent } from "@/lib/theme-colors";
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
  fact: "fact",
  facts: "fact",
  "shadow-match": "shadow",
};

const PROGRESS_KEY_BY_SERVER_KEY: Partial<Record<string, GameId>> = {
  "color-focus": "tsvet",
  "color-stroop": "tsvet",
  "reflex-hit": "udar",
  strike: "udar",
  "find-number": "space-find-number",
  "geo-master": "geography-quiz",
  fact: "pulse",
  facts: "pulse",
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

function GamesHeader() {
  const theme = useAppTheme();
  const { language } = useTranslation();
  const coinBalance = useAppStore((state) => state.coinBalance);

  return (
    <ScreenHeader
      title={copy[language].title}
      action={
        <GlassSurface intensity={64} variant="strong" style={styles.count}>
          <Ionicons name="diamond" size={18} color={String(theme.primary)} />
          <AppText style={[styles.countText, { color: theme.primary }]}>{coinBalance} coin</AppText>
        </GlassSurface>
      }
    />
  );
}

const GameCard = memo(function GameCard({ game, ready, wide, onOpenSkins }: {
  game: GameCatalogItem;
  ready: boolean;
  wide: boolean;
  onOpenSkins: (gameId: GameId) => void;
}) {
  const theme = useAppTheme();
  const router = useRouter();
  const { language } = useTranslation();
  const c = copy[language];
  const progressKey = PROGRESS_KEY_BY_SERVER_KEY[game.key] ?? (game.key as GameId);
  const coins = useGameProgressStore((state) => ready ? state.games[progressKey]?.coins ?? EMPTY_GAME_PROGRESS.coins : EMPTY_GAME_PROGRESS.coins);
  const cover = gameCoverFor(game.key);
  const accent = readableAccent(game.color, theme.mode);
  const playForeground = accentForeground(game.color, theme.mode);
  const play = () => router.push({ pathname: "/play/[gameKey]", params: { gameKey: game.key, mode: "practice" } } as never);

  return (
    <View collapsable={false} style={[styles.cell, wide && styles.cellWide]}>
      <GlassSurface intensity={68} variant="strong" style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${c.play}: ${game.title}`} onPress={play} style={({ pressed }) => [styles.playArea, pressed && styles.pressed]}>
          <View style={[styles.icon, { backgroundColor: `${accent}18`, borderColor: `${accent}38` }]}>
            {cover ? <Image source={cover} resizeMode="cover" {...androidImageProps} style={styles.cover} accessibilityIgnoresInvertColors /> : <Ionicons name={game.icon as React.ComponentProps<typeof Ionicons>["name"]} color={accent} size={28} />}
          </View>
          <View style={styles.copy}>
            <AppText style={[styles.title, { color: theme.text }]} numberOfLines={1}>{game.title}</AppText>
            <View style={styles.bestRow}>
              <Ionicons name="diamond-outline" size={13} color={accent} />
              <AppText style={[styles.best, { color: accent }]}>{c.best} {Math.min(1000, coins)}</AppText>
            </View>
          </View>
        </Pressable>
        <View style={styles.cardActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Скины: ${game.title}`} onPress={() => onOpenSkins(progressKey)} style={({ pressed }) => [styles.skinButton, { borderColor: `${accent}42`, backgroundColor: `${accent}13` }, pressed && styles.pressed]}>
            <Ionicons name="shirt-outline" color={accent} size={17} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${c.play}: ${game.title}`} onPress={play} style={({ pressed }) => [styles.playButton, { backgroundColor: game.color }, pressed && styles.pressed]}>
            <Ionicons name="play" color={playForeground} size={15} />
            <AppText style={[styles.playText, { color: playForeground }]}>{c.play}</AppText>
          </Pressable>
        </View>
      </GlassSurface>
    </View>
  );
});

function CatalogRowSeparator() {
  return <View style={styles.rowSeparator} />;
}

function CatalogProgressSync() {
  useGameProgressSync();
  return null;
}

const catalogRowKey = (row: GameCatalogItem[]) => row[0].key;

export default function GamesScreen() {
  const { language } = useTranslation();
  const { isTablet, isDesktop } = useResponsiveLayout();
  const accessToken = useAppStore((state) => state.accessToken);
  const authMode = useAppStore((state) => state.authMode);
  const ready = useClientReady();
  const [economyGameId, setEconomyGameId] = useState<GameId | null>(null);
  const wide = isTablet || isDesktop;
  const query = useQuery({
    queryKey: ["games", accessToken],
    queryFn: () => gamesApi.list(accessToken!),
    enabled: authMode === "authenticated" && Boolean(accessToken),
    staleTime: 60_000,
  });
  const authenticated = authMode === "authenticated" && Boolean(accessToken);
  const games = useMemo(() => {
    const catalog = authenticated && query.isSuccess
      ? query.data
          .filter((entry) => entry.practiceEnabled)
          .map(mapServerGame)
          .filter((entry): entry is LocalizedGame => entry !== null)
      : GAME_CATALOG;
    return catalog.map((entry) => localizeGame(entry, language));
  }, [authenticated, language, query.data, query.isSuccess]);
  const rows = useMemo(() => {
    const result: GameCatalogItem[][] = [];
    const columns = wide ? 2 : 1;
    for (let index = 0; index < games.length; index += columns) {
      result.push(games.slice(index, index + columns));
    }
    return result;
  }, [games, wide]);
  const renderRow = useCallback(({ item }: ListRenderItemInfo<GameCatalogItem[]>) => (
    <View style={wide ? styles.listRowWide : undefined}>
      {item.map((game) => <GameCard key={game.key} game={game} ready={ready} wide={wide} onOpenSkins={setEconomyGameId} />)}
    </View>
  ), [ready, wide]);
  const renderNativeCatalog = (contentContainerStyle: StyleProp<ViewStyle>) => (
    <>
      <FlatList
        role="main"
        style={styles.list}
        contentContainerStyle={contentContainerStyle}
        data={rows}
        keyExtractor={catalogRowKey}
        renderItem={renderRow}
        ListHeaderComponent={GamesHeader}
        ItemSeparatorComponent={CatalogRowSeparator}
        initialNumToRender={6}
        maxToRenderPerBatch={3}
        windowSize={3}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
      {economyGameId ? <GameEconomyModal gameId={economyGameId} visible onClose={() => setEconomyGameId(null)} /> : null}
    </>
  );

  return (
    <>
      <CatalogProgressSync />
      <AppFrame wide desktopNavigationInset contentStyle={styles.page} scrollProps={{ removeClippedSubviews: false }} renderScrollContent={Platform.OS === "android" ? renderNativeCatalog : undefined}>
        {Platform.OS !== "android" ? (
          <>
            <GamesHeader />
            <View style={[styles.grid, wide && styles.gridWide]}>
              {games.map((game) => <GameCard key={game.key} game={game} ready={ready} wide={wide} onOpenSkins={setEconomyGameId} />)}
            </View>
            {economyGameId ? <GameEconomyModal gameId={economyGameId} visible onClose={() => setEconomyGameId(null)} /> : null}
          </>
        ) : null}
      </AppFrame>
    </>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 1180 },
  count: { minHeight: 46, borderRadius: 18, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  countText: { fontSize: 12, lineHeight: 15, fontWeight: "900" },
  grid: { gap: 11 },
  gridWide: { flexDirection: "row", flexWrap: "wrap" },
  list: { flex: 1 },
  listRowWide: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  rowSeparator: { height: 11 },
  cell: { width: "100%" },
  cellWide: { width: "49%", minWidth: 330, flexGrow: 1 },
  playArea: { flex: 1, minWidth: 0, alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: 13, borderRadius: 22 },
  pressed: { opacity: 0.87, transform: [{ scale: 0.99 }] },
  card: { minHeight: 106, borderRadius: 28, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, overflow: "hidden" },
  icon: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cover: { width: "100%", height: "100%", borderRadius: 31 },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "900" },
  bestRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  best: { fontSize: 10, lineHeight: 13, fontWeight: "900" },
  cardActions: { alignItems: "center", gap: 7 },
  skinButton: { width: 34, height: 34, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  playButton: { minWidth: 82, minHeight: 42, borderRadius: 21, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  playText: { color: "#FFFFFF", fontSize: 11, lineHeight: 14, fontWeight: "900" },
});
