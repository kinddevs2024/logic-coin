import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, type TextStyle, View, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, Easing, FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ArcadeGameSkin } from "./types";
import { gameCoinReward } from "../../rewards";

type GradientColors = readonly [string, string, ...string[]];

function parseHex(color: string) {
  const normalized = color.trim().replace("#", "");
  if (!/^[\da-f]{6}$/i.test(normalized)) return null;
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function mixHex(base: string, tint: string, amount: number) {
  const baseRgb = parseHex(base);
  const tintRgb = parseHex(tint);
  if (!baseRgb || !tintRgb) return base;
  const mix = (from: number, to: number) => Math.round(from + (to - from) * amount).toString(16).padStart(2, "0");
  return `#${mix(baseRgb.red, tintRgb.red)}${mix(baseRgb.green, tintRgb.green)}${mix(baseRgb.blue, tintRgb.blue)}`;
}

function withAlpha(color: string, alpha: number) {
  const rgb = parseHex(color);
  return rgb ? `rgba(${rgb.red},${rgb.green},${rgb.blue},${alpha})` : "rgba(255,255,255,0.04)";
}

function isCustomSkin(skin?: ArcadeGameSkin) {
  return Boolean(skin && skin.id !== "classic");
}

export function resolveArcadeSkin(skin: ArcadeGameSkin | undefined, primary: string, secondary: string) {
  if (!isCustomSkin(skin)) return { id: skin?.id ?? "classic", primary, secondary };
  return { id: skin!.id, primary: skin!.primary, secondary: skin!.secondary };
}

export function impact(kind: "light" | "medium" | "success" | "error" = "light") {
  if (kind === "success") return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  if (kind === "error") return void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  const style = kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
  void Haptics.impactAsync(style).catch(() => undefined);
}

function resetWebScroll() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
}

export function GameRoot({ colors, children, skin }: { colors: GradientColors; children: ReactNode; skin?: ArcadeGameSkin }) {
  const custom = isCustomSkin(skin);
  const reducedMotion = useReducedMotion();
  const driftOne = useSharedValue(0);
  const driftTwo = useSharedValue(0);
  const themedColors = custom
    ? colors.map((color, index) => mixHex(color, index === 1 ? skin!.secondary : skin!.primary, index === 0 ? 0.28 : 0.12)) as unknown as GradientColors
    : colors;
  useEffect(() => {
    if (reducedMotion) return;
    driftOne.value = withRepeat(withSequence(withTiming(1, { duration: 6_800, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 6_800, easing: Easing.inOut(Easing.sin) })), -1);
    driftTwo.value = withRepeat(withSequence(withTiming(1, { duration: 8_200, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 8_200, easing: Easing.inOut(Easing.sin) })), -1);
    return () => {
      cancelAnimation(driftOne);
      cancelAnimation(driftTwo);
    };
  }, [driftOne, driftTwo, reducedMotion]);
  const ambientOneMotion = useAnimatedStyle(() => ({
    transform: [{ translateX: driftOne.value * 32 }, { translateY: driftOne.value * 22 }, { scale: 1 + driftOne.value * 0.08 }],
  }));
  const ambientTwoMotion = useAnimatedStyle(() => ({
    transform: [{ translateX: driftTwo.value * -26 }, { translateY: driftTwo.value * -34 }, { scale: 1 + driftTwo.value * 0.06 }],
  }));
  return (
    <LinearGradient colors={themedColors} style={styles.root}>
      <Animated.View pointerEvents="none" style={[styles.ambientOne, custom && { backgroundColor: withAlpha(skin!.primary, 0.16) }, ambientOneMotion]} />
      <Animated.View pointerEvents="none" style={[styles.ambientTwo, custom && { backgroundColor: withAlpha(skin!.secondary, 0.11) }, ambientTwoMotion]} />
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.safe}>{children}</SafeAreaView>
    </LinearGradient>
  );
}

export function GameHeader({ title, accent, onExit, right }: { title: string; accent: string; onExit?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Назад" hitSlop={12} onPress={onExit} style={styles.iconButton}>
        <Ionicons name="chevron-back" color="#FFFFFF" size={23} />
      </Pressable>
      <Text numberOfLines={1} style={[styles.headerTitle, { color: accent }]}>{title}</Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function GlassPanel({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function HudStat({ label, value, color = "#FFFFFF", style }: { label: string; value: string | number; color?: string; style?: ViewStyle }) {
  const coinMetric = /(сч[её]т|очки|очков|score|рекорд|best)/i.test(label);
  const visibleLabel = coinMetric ? (/(рекорд|best)/i.test(label) ? "ЛУЧШИЙ COIN" : "COIN") : label;
  const visibleValue = coinMetric && typeof value === "number" ? gameCoinReward(value) : value;
  return (
    <View style={[styles.stat, style]}>
      <Text style={styles.statLabel}>{visibleLabel}</Text>
      <Text numberOfLines={1} style={[styles.statValue, { color }]}>{visibleValue}</Text>
    </View>
  );
}

export function LivesStat({ lives, total = 3, color = "#FF5572", style }: { lives: number; total?: number; color?: string; style?: ViewStyle }) {
  return (
    <View style={[styles.stat, style]}>
      <Text style={styles.statLabel}>Жизни</Text>
      <View accessibilityLabel={`${Math.max(0, lives)} из ${total} жизней`} style={styles.lifeRow}>
        {Array.from({ length: total }, (_, index) => (
          <View key={index} style={[styles.lifePip, { borderColor: color }, index < lives ? { backgroundColor: color } : styles.lifePipEmpty]} />
        ))}
      </View>
    </View>
  );
}

export function ProgressBar({ progress, color, track = "rgba(255,255,255,0.10)", height = 5 }: { progress: number; color: string; track?: string; height?: number }) {
  const width = `${Math.max(0, Math.min(1, progress)) * 100}%` as `${number}%`;
  return <View style={[styles.progressTrack, { backgroundColor: track, height }]}><View style={[styles.progressFill, { backgroundColor: color, width }]} /></View>;
}

export function ArcadeButton({ children, onPress, accent = "#FFFFFF", textColor = "#090A10", disabled = false, style }: { children: ReactNode; onPress: () => void; accent?: string; textColor?: string; disabled?: boolean; style?: ViewStyle }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => { impact("medium"); onPress(); resetWebScroll(); }}
      onPressIn={() => { scale.set(withSpring(0.96, { damping: 18, stiffness: 300 })); }}
      onPressOut={() => { scale.set(withSpring(1, { damping: 16, stiffness: 260 })); }}
      style={style}
    >
      <Animated.View style={[styles.button, { backgroundColor: accent, opacity: disabled ? 0.45 : 1 }, animated]}>
        <Text style={[styles.buttonText, { color: textColor }]}>{children}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function IntroScreen({ eyebrow, title, subtitle, accent, children, onStart }: { eyebrow?: string; title: string; subtitle: string; accent: string; children?: ReactNode; onStart: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(180)} style={styles.centerScreen}>
      {eyebrow ? <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text> : null}
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSubtitle}>{subtitle}</Text>
      {children}
      <ArcadeButton accent={accent} onPress={onStart} style={styles.wideButton}>НАЧАТЬ</ArcadeButton>
    </Animated.View>
  );
}

export function ResultScreen({ title, score, accent, stats, onRestart, onExit }: { title: string; score: number; accent: string; stats: { label: string; value: string | number }[]; onRestart: () => void; onExit?: () => void }) {
  const coins = gameCoinReward(score);
  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.centerScreen}>
      <Text style={[styles.eyebrow, { color: accent }]}>РЕЗУЛЬТАТ</Text>
      <Text style={styles.resultTitle}>{title}</Text>
      <Text style={[styles.resultScore, { color: accent }]}>{coins}</Text>
      <Text style={styles.resultLabel}>COIN</Text>
      <View style={styles.resultGrid}>{stats.map((item) => <HudStat key={item.label} label={item.label} value={item.value} />)}</View>
      <ArcadeButton accent={accent} onPress={onRestart} style={styles.wideButton}>ЕЩЁ РАЗ</ArcadeButton>
      {onExit ? <Pressable onPress={onExit} style={styles.exitLink}><Text style={styles.exitText}>Выйти</Text></Pressable> : null}
    </Animated.View>
  );
}

export const arcadeText = StyleSheet.create({
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { color: "rgba(255,255,255,0.52)", fontSize: 12, fontWeight: "700", letterSpacing: 1.2 },
  body: { color: "rgba(255,255,255,0.72)", fontSize: 14, lineHeight: 20 },
  mono: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"] } as TextStyle,
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 16 },
  ambientOne: { position: "absolute", top: -160, left: -100, width: 360, height: 360, borderRadius: 180, backgroundColor: "rgba(255,255,255,0.045)", ...(Platform.OS === "web" ? ({ filter: "blur(34px)" } as unknown as ViewStyle) : {}) },
  ambientTwo: { position: "absolute", right: -140, bottom: -180, width: 420, height: 420, borderRadius: 210, backgroundColor: "rgba(255,255,255,0.035)", ...(Platform.OS === "web" ? ({ filter: "blur(42px)" } as unknown as ViewStyle) : {}) },
  header: { minHeight: 58, marginTop: 6, marginBottom: 9, paddingHorizontal: 7, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(10,15,29,0.76)", shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  iconButton: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 2, borderColor: "rgba(255,255,255,0.17)" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "900", letterSpacing: 1.2 },
  headerRight: { minWidth: 42, alignItems: "flex-end" },
  panel: { backgroundColor: "rgba(12,18,34,0.82)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", borderRadius: 20, padding: 16, shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 14 } },
  stat: { flex: 1, minWidth: 72, alignItems: "center", justifyContent: "center", paddingVertical: 9, paddingHorizontal: 6, borderRadius: 12, backgroundColor: "rgba(12,18,34,0.74)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", shadowColor: "#000000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  statLabel: { color: "rgba(255,255,255,0.38)", fontSize: 8, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  statValue: { marginTop: 3, fontSize: 21, fontWeight: "900", fontVariant: ["tabular-nums"] },
  lifeRow: { minHeight: 25, flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  lifePip: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  lifePipEmpty: { backgroundColor: "transparent", opacity: 0.32 },
  progressTrack: { width: "100%", borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 99 },
  button: { minHeight: 54, paddingHorizontal: 26, borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.32)", alignItems: "center", justifyContent: "center", shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  buttonText: { fontSize: 14, fontWeight: "900", letterSpacing: 2 },
  centerScreen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, gap: 14 },
  eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 4 },
  heroTitle: { color: "#FFFFFF", fontSize: 48, lineHeight: 50, fontWeight: "900", textAlign: "center", letterSpacing: -2 },
  heroSubtitle: { color: "rgba(255,255,255,0.52)", fontSize: 14, lineHeight: 21, fontWeight: "600", textAlign: "center", maxWidth: 340 },
  wideButton: { width: "100%", maxWidth: 350, marginTop: 12 },
  resultTitle: { color: "#FFFFFF", fontSize: 36, lineHeight: 40, fontWeight: "900", textAlign: "center" },
  resultScore: { fontSize: 74, lineHeight: 78, fontWeight: "900", fontVariant: ["tabular-nums"] },
  resultLabel: { marginTop: -18, color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: "900", letterSpacing: 3 },
  resultGrid: { width: "100%", maxWidth: 350, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  exitLink: { padding: 12 },
  exitText: { color: "rgba(255,255,255,0.48)", fontSize: 13, fontWeight: "700" },
});
