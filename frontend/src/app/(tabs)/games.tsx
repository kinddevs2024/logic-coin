import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, ReduceMotion } from "react-native-reanimated";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenHeader } from "@/components/screen-header";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTranslation } from "@/hooks/use-translation";

const copy = {
  ru: { title: "Игры", tetris: "Тетрис", chess: "Шахматы", merge: "2048", solo: "Один игрок", duo: "Два игрока" },
  en: { title: "Games", tetris: "Tetris", chess: "Chess", merge: "2048", solo: "Solo", duo: "Two players" },
  uz: { title: "O‘yinlar", tetris: "Tetris", chess: "Shaxmat", merge: "2048", solo: "Bir o‘yinchi", duo: "Ikki o‘yinchi" },
} as const;

export default function GamesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { language } = useTranslation();
  const { isTablet } = useResponsiveLayout();
  const c = copy[language];
  const games = [
    { key: "tetris", title: c.tetris, caption: c.solo, icon: "grid-outline" as const, color: "#0A84FF" },
    { key: "chess", title: c.chess, caption: c.duo, icon: "people-outline" as const, color: "#7C5CFC" },
    { key: "2048", title: c.merge, caption: c.solo, icon: "apps-outline" as const, color: "#FF9F0A" },
  ];
  return (
    <AppFrame wide desktopNavigationInset>
      <ScreenHeader title={c.title} />
      <View style={[styles.grid, isTablet && styles.gridWide]}>
        {games.map((game, index) => (
          <Animated.View
            key={game.key}
            entering={FadeInUp.delay(index * 70).duration(280).reduceMotion(ReduceMotion.System)}
            style={[styles.cell, isTablet && styles.cellWide]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={game.title}
              onPress={() => router.push(`/games/${game.key}` as never)}
              style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
            >
              <GlassSurface variant="strong" intensity={56} style={styles.card}>
                <View style={[styles.icon, { backgroundColor: `${game.color}18` }]}>
                  <Ionicons name={game.icon} color={game.color} size={28} />
                </View>
                <View style={styles.copy}>
                  <AppText variant="heading">{game.title}</AppText>
                  <AppText variant="caption" muted>{game.caption}</AppText>
                </View>
                <View style={[styles.arrow, { backgroundColor: theme.primary }]}>
                  <Ionicons name="arrow-forward" color="#FFFFFF" size={18} />
                </View>
              </GlassSurface>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  gridWide: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "100%" },
  cellWide: { width: "49%", minWidth: 320 },
  pressable: { borderRadius: 28 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  card: {
    minHeight: 112,
    borderRadius: 28,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  icon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 2 },
  arrow: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
