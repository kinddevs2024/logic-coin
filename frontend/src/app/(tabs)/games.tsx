import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenHeader } from "@/components/screen-header";
import { EMPTY_GAME_PROGRESS, type GameId, type GameProgress, useGameProgressStore } from "@/games/progress-store";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useClientReady } from "@/hooks/use-client-ready";
import { useGameProgressSync } from "@/hooks/use-game-progress-sync";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTranslation } from "@/hooks/use-translation";

const copy = {
  ru: { title: "Игры", subtitle: "Продолжайте с последнего уровня", tetris: "Тетрис", chess: "Шахматы", merge: "2048", longcat: "Хвостатый путь", gobble: "Карманная воронка", loops: "Живые линии", brain: "Хитрые мысли", solo: "Один игрок", duo: "Два игрока", fill: "Заполни всё поле", eat: "Поглоти предметы — избегай людей", connect: "Соедини каждый путь", think: "Думай иначе", newBadge: "Новое", level: "Уровень", best: "Рекорд", play: "Играть" },
  en: { title: "Games", subtitle: "Continue where you left off", tetris: "Tetris", chess: "Chess", merge: "2048", longcat: "Trail Cat", gobble: "Pocket Vortex", loops: "Living Lines", brain: "Brain Tricks", solo: "Solo", duo: "Two players", fill: "Fill every space", eat: "Swallow objects — avoid people", connect: "Connect every path", think: "Think differently", newBadge: "New", level: "Level", best: "Best", play: "Play" },
  uz: { title: "O'yinlar", subtitle: "Oxirgi bosqichdan davom eting", tetris: "Tetris", chess: "Shaxmat", merge: "2048", longcat: "Uzun mushuk", gobble: "Cho‘ntak girdobi", loops: "Jonli chiziqlar", brain: "Aqlli topishmoqlar", solo: "Bir o'yinchi", duo: "Ikki o'yinchi", fill: "Barcha maydonni to'ldiring", eat: "Buyumlarni yuting — odamlardan saqlaning", connect: "Barcha yo'llarni ulang", think: "Boshqacha o'ylang", newBadge: "Yangi", level: "Bosqich", best: "Rekord", play: "O'ynash" },
} as const;

type Copy = { [Key in keyof (typeof copy)["en"]]: string };
type GameDef = { key: GameId; title: keyof Copy; caption: keyof Copy; icon: React.ComponentProps<typeof Ionicons>["name"]; accent: string; levels?: number; isNew?: boolean };

const gameDefs: GameDef[] = [
  { key: "tetris", title: "tetris", caption: "solo", icon: "grid-outline", accent: "#087CFF" },
  { key: "chess", title: "chess", caption: "duo", icon: "people-outline", accent: "#705CF6" },
  { key: "2048", title: "merge", caption: "solo", icon: "apps-outline", accent: "#F59E0B" },
  { key: "longcat", title: "longcat", caption: "fill", icon: "git-branch-outline", accent: "#F07D5A", levels: 20 },
  { key: "gobble", title: "gobble", caption: "eat", icon: "radio-button-on-outline", accent: "#8A5CF6", levels: 30 },
  { key: "loops", title: "loops", caption: "connect", icon: "infinite-outline", accent: "#B45C66", levels: 30, isNew: true },
  { key: "brain-tricks", title: "brain", caption: "think", icon: "bulb-outline", accent: "#27A66F", levels: 40, isNew: true },
];

function GameCard({ game, progress, c, wide, onPress }: { game: GameDef; progress: Readonly<GameProgress>; c: Copy; wide: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const level = Math.min(game.levels ?? progress.highestUnlockedLevel, Math.max(1, progress.currentLevel));
  return (
    <View style={[styles.cell, wide && styles.cellWide]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${c[game.title]}. ${c.play}`} onPress={onPress} style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
        <GlassSurface intensity={64} variant="strong" style={styles.card}>
          <View style={[styles.icon, { backgroundColor: `${game.accent}18`, borderColor: `${game.accent}38` }]}><Ionicons name={game.icon} color={game.accent} size={29} /></View>
          <View style={styles.copy}>
            <View style={styles.titleRow}><AppText style={[styles.gameTitle, { color: theme.text }]}>{c[game.title]}</AppText>{game.isNew ? <View style={[styles.badge, { backgroundColor: `${game.accent}18` }]}><AppText style={[styles.badgeText, { color: game.accent }]}>{c.newBadge}</AppText></View> : null}</View>
            <AppText style={[styles.caption, { color: theme.textMuted }]} numberOfLines={1}>{c[game.caption]}</AppText>
            <AppText style={[styles.progress, { color: game.accent }]}>{game.levels ? `${c.level} ${level} / ${game.levels}` : `${c.best} ${progress.bestScore}`}</AppText>
          </View>
          <View style={[styles.arrow, { backgroundColor: `${game.accent}12` }]}><Ionicons name="arrow-forward" color={game.accent} size={18} /></View>
        </GlassSurface>
      </Pressable>
    </View>
  );
}

export default function GamesScreen() {
  const router = useRouter();
  const { language } = useTranslation();
  const { isTablet, isDesktop } = useResponsiveLayout();
  const games = useGameProgressStore((state) => state.games);
  const clientReady = useClientReady();
  const c = copy[language];
  useGameProgressSync();
  const wide = isTablet || isDesktop;
  return (
    <AppFrame wide desktopNavigationInset contentStyle={styles.page}>
      <ScreenHeader title={c.title} subtitle={c.subtitle} action={<GlassSurface intensity={54} style={styles.headerIcon}><Ionicons name="game-controller-outline" size={25} color="#087CFF" /></GlassSurface>} />
      <View style={[styles.grid, wide && styles.gridWide]}>
        {gameDefs.map((game) => <GameCard key={game.key} game={game} c={c} progress={clientReady ? games[game.key] ?? EMPTY_GAME_PROGRESS : EMPTY_GAME_PROGRESS} wide={wide} onPress={() => router.push(`/games/${game.key}` as never)} />)}
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 1180 },
  headerIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  grid: { gap: 12 },
  gridWide: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "100%" },
  cellWide: { width: "49%", minWidth: 320, flexGrow: 1 },
  pressable: { borderRadius: 29 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  card: { minHeight: 116, borderRadius: 29, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  icon: { width: 60, height: 60, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gameTitle: { fontSize: 18, lineHeight: 23, fontWeight: "900" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  progress: { marginTop: 3, fontSize: 11, lineHeight: 14, fontWeight: "800" },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 9, lineHeight: 11, fontWeight: "900", textTransform: "uppercase" },
  arrow: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
