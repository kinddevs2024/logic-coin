import { useEffect, type PropsWithChildren, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { cancelAnimation, Easing, FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { ArcadeIcon, type ArcadeIconName } from "./icons";
import type { ArcadeGameSkin } from "./types";
import { gameCoinReward } from "../../rewards";

export const B_COLORS = {
  ink: "#F8FAFF",
  muted: "#8E9AB6",
  panel: "rgba(15, 22, 42, 0.86)",
  panelSoft: "rgba(255,255,255,0.055)",
  border: "rgba(255,255,255,0.10)",
  cyan: "#2EE8FF",
  gold: "#FFD85A",
  green: "#4EF2A3",
  red: "#FF5E7D",
  violet: "#A879FF",
} as const;

export function lightTap() {
  void Haptics.selectionAsync().catch(() => {});
}

export function successTap() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function errorTap() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

function resetWebScroll() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
}

export function arcadeSkinAccent(skin: ArcadeGameSkin | undefined, fallback: string) {
  return skin && skin.id !== "classic" ? skin.primary : fallback;
}

type GameScreenProps = PropsWithChildren<{
  title: string;
  accent?: string;
  onExit?: () => void;
  right?: ReactNode;
  scroll?: boolean;
  skin?: ArcadeGameSkin;
}>;

export function GameScreen({ title, accent = B_COLORS.cyan, onExit, right, scroll = false, skin, children }: GameScreenProps) {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const drift = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    drift.value = withRepeat(withSequence(withTiming(1, { duration: 7_400, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 7_400, easing: Easing.inOut(Easing.sin) })), -1);
    return () => cancelAnimation(drift);
  }, [drift, reducedMotion]);
  const glowMotion = useAnimatedStyle(() => ({
    transform: [{ translateX: drift.value * -34 }, { translateY: drift.value * 38 }, { scale: 1 + drift.value * 0.08 }],
  }));
  const content = (
    <View style={[styles.content, width >= 760 && styles.contentWide]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Выйти из игры"
          hitSlop={12}
          onPress={() => {
            lightTap();
            onExit?.();
          }}
          style={styles.iconButton}
        >
          <ArcadeIcon name="chevron-left" size={25} color={B_COLORS.ink} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: accent }]}>{title}</Text>
        <View style={styles.headerRight}>{right ?? <View style={styles.headerSpacer} />}</View>
      </View>
      {children}
    </View>
  );

  return (
    <LinearGradient colors={["#050711", "#0A1021", "#070815"]} style={styles.fill}>
      {skin && skin.id !== "classic" ? <View pointerEvents="none" style={[styles.skinWash, { backgroundColor: skin.secondary }]} /> : null}
      <Animated.View pointerEvents="none" style={[styles.glow, { backgroundColor: accent }, glowMotion]} />
      <View pointerEvents="none" style={[styles.skinRail, { backgroundColor: accent }]} />
      <SafeAreaView style={styles.fill} edges={["top", "bottom"]}>
        {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
      </SafeAreaView>
    </LinearGradient>
  );
}

export function Panel({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Metric({ label, value, color = B_COLORS.ink }: { label: string; value: string | number; color?: string }) {
  const coinMetric = /(сч[её]т|очки|очков|score|рекорд|best)/i.test(label);
  const visibleLabel = coinMetric ? (/(рекорд|best)/i.test(label) ? "ЛУЧШИЙ COIN" : "COIN") : label;
  const visibleValue = coinMetric && typeof value === "number" ? gameCoinReward(value) : value;
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{visibleLabel}</Text>
      <Text numberOfLines={1} style={[styles.metricValue, { color }]}>{visibleValue}</Text>
    </View>
  );
}

export function CoinPill({ value }: { value: number }) {
  return (
    <View style={styles.coinPill}>
      <ArcadeIcon name="circle-multiple" size={17} color={B_COLORS.gold} />
      <Text style={styles.coinText}>{value}</Text>
    </View>
  );
}

export function ProgressTrack({ value, color = B_COLORS.cyan }: { value: number; color?: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.trackFill, { backgroundColor: color, width: `${Math.max(0, Math.min(1, value)) * 100}%` }]} />
    </View>
  );
}

export function GameButton({ label, onPress, accent = B_COLORS.cyan, secondary = false, disabled = false }: {
  label: string;
  onPress: () => void;
  accent?: string;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        lightTap();
        onPress();
        resetWebScroll();
      }}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.buttonSecondary : { backgroundColor: accent, shadowColor: accent },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

export function AnswerButton({ label, onPress, accent = B_COLORS.cyan, state = "idle", disabled = false }: {
  label: string;
  onPress: () => void;
  accent?: string;
  state?: "idle" | "correct" | "wrong" | "dim";
  disabled?: boolean;
}) {
  const bg = state === "correct" ? "rgba(78,242,163,.18)" : state === "wrong" ? "rgba(255,94,125,.18)" : B_COLORS.panelSoft;
  const border = state === "correct" ? B_COLORS.green : state === "wrong" ? B_COLORS.red : state === "dim" ? "rgba(255,255,255,.04)" : `${accent}55`;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.answer, { backgroundColor: bg, borderColor: border }, pressed && styles.pressed, state === "dim" && styles.disabled]}
    >
      <Text style={styles.answerText}>{label}</Text>
    </Pressable>
  );
}

export function StartCard({ icon, title, subtitle, accent, details, options, onStart }: {
  icon: ArcadeIconName;
  title: string;
  subtitle: string;
  accent: string;
  details: string[];
  options?: ReactNode;
  onStart: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.springify().damping(17)} style={styles.startWrap}>
      <View style={[styles.startIcon, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}>
        <ArcadeIcon name={icon} size={42} color={accent} />
      </View>
      <Text style={[styles.startTitle, { color: accent }]}>{title}</Text>
      <Text style={styles.startSubtitle}>{subtitle}</Text>
      <Panel style={styles.rules}>
        {details.map((detail, index) => (
          <View key={detail} style={styles.ruleRow}>
            <Text style={[styles.ruleIndex, { color: accent }]}>{String(index + 1).padStart(2, "0")}</Text>
            <Text style={styles.ruleText}>{detail}</Text>
          </View>
        ))}
      </Panel>
      {options}
      <GameButton label="ИГРАТЬ" onPress={onStart} accent={accent} />
    </Animated.View>
  );
}

export function ResultCard({ icon, title, score, coins, accent, stats, onReplay, onExit }: {
  icon: ArcadeIconName;
  title: string;
  score: number;
  coins: number;
  accent: string;
  stats: { label: string; value: string | number }[];
  onReplay: () => void;
  onExit?: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.springify()} exiting={FadeOut} style={styles.resultBackdrop}>
      <Panel style={styles.resultCard}>
        <View style={[styles.resultIcon, { borderColor: `${accent}55`, backgroundColor: `${accent}14` }]}>
          <ArcadeIcon name={icon} size={36} color={accent} />
        </View>
        <Text style={[styles.resultTitle, { color: accent }]}>{title}</Text>
        <Text style={styles.resultScore}>{Math.min(1_000, Math.max(0, coins)).toLocaleString("ru-RU")}</Text>
        <Text style={styles.resultLabel}>COIN</Text>
        <View style={styles.resultStats}>
          {stats.map((stat) => <Metric key={stat.label} label={stat.label} value={stat.value} color={accent} />)}
        </View>
        <GameButton label="ЕЩЁ РАЗ" onPress={onReplay} accent={accent} />
        {onExit ? <GameButton label="ВЫЙТИ" onPress={onExit} accent={accent} secondary /> : null}
      </Panel>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  skinWash: { ...StyleSheet.absoluteFill, opacity: 0.035 },
  glow: { position: "absolute", width: 360, height: 360, borderRadius: 180, opacity: 0.08, top: -190, right: -160, ...(Platform.OS === "web" ? ({ filter: "blur(38px)" } as unknown as ViewStyle) : {}) },
  skinRail: { position: "absolute", top: 0, left: "20%", right: "20%", height: 2, opacity: 0.72, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  scroll: { flexGrow: 1 },
  content: { flex: 1, width: "100%", alignSelf: "center", paddingHorizontal: 16, paddingBottom: 12 },
  contentWide: { maxWidth: 760, paddingHorizontal: 24 },
  header: { minHeight: 58, marginTop: 6, marginBottom: 9, paddingHorizontal: 7, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(10,15,29,0.76)", shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  iconButton: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 2, borderColor: "rgba(255,255,255,0.17)" },
  headerTitle: { flex: 1, textAlign: "center", fontWeight: "900", letterSpacing: 2, fontSize: 15 },
  headerRight: { minWidth: 40, alignItems: "flex-end" },
  headerSpacer: { width: 40 },
  panel: { backgroundColor: "rgba(12,18,34,0.82)", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", padding: 16, overflow: "hidden", shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 14 } },
  metric: { minWidth: 68, minHeight: 53, flex: 1, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.035)" },
  metricLabel: { color: B_COLORS.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  metricValue: { fontSize: 20, fontWeight: "900" },
  coinPill: { minWidth: 62, height: 36, paddingHorizontal: 11, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "rgba(255,216,90,.10)", borderWidth: 1, borderColor: "rgba(255,216,90,.28)" },
  coinText: { color: B_COLORS.gold, fontSize: 14, fontWeight: "900" },
  track: { height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,.07)", overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: 3 },
  button: { minHeight: 54, width: "100%", borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.30)", justifyContent: "center", alignItems: "center", shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 6 },
  buttonSecondary: { backgroundColor: B_COLORS.panelSoft, borderWidth: 1, borderColor: B_COLORS.border, shadowOpacity: 0 },
  buttonText: { color: "#07101B", fontSize: 15, fontWeight: "900", letterSpacing: 2 },
  disabled: { opacity: 0.34 },
  pressed: { transform: [{ scale: 0.97 }] },
  answer: { width: "100%", minHeight: 58, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, justifyContent: "center", alignItems: "center", shadowColor: "#000000", shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  answerText: { color: B_COLORS.ink, fontSize: 18, fontWeight: "800", textAlign: "center" },
  startWrap: { flex: 1, width: "100%", maxWidth: 430, alignSelf: "center", alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 18 },
  startIcon: { width: 68, height: 68, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  startTitle: { fontSize: 42, lineHeight: 45, fontWeight: "900", letterSpacing: 2, textAlign: "center" },
  startSubtitle: { color: B_COLORS.muted, fontSize: 12, fontWeight: "700", letterSpacing: 2, textAlign: "center", textTransform: "uppercase" },
  rules: { width: "100%", gap: 9, marginVertical: 10 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ruleIndex: { width: 26, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  ruleText: { flex: 1, color: "#CCD4E6", fontSize: 13, fontWeight: "600", lineHeight: 18 },
  resultBackdrop: { ...StyleSheet.absoluteFill, zIndex: 100, justifyContent: "center", alignItems: "center", padding: 18, backgroundColor: "rgba(2,4,12,.90)" },
  resultCard: { width: "100%", maxWidth: 430, alignItems: "center", gap: 12, padding: 24 },
  resultIcon: { width: 58, height: 58, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  resultTitle: { fontSize: 26, fontWeight: "900", letterSpacing: 2, textAlign: "center" },
  resultScore: { color: B_COLORS.ink, fontSize: 54, lineHeight: 58, fontWeight: "900" },
  resultLabel: { color: B_COLORS.muted, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  resultStats: { width: "100%", flexDirection: "row", gap: 8, marginVertical: 5 },
});
