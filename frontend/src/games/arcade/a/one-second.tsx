import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { ArcadeButton, GameHeader, GameRoot, GlassPanel, HudStat, ProgressBar, ResultScreen, impact, resolveArcadeSkin } from "./primitives";
import type { ArcadeGameProps, ArcadeGameResult } from "./types";
import { suggestedCoins } from "./utils";

const GAME_ID = "one-second" as const;
const TARGET_MS = 1000;
const DEFAULT_CHALLENGE_ATTEMPTS = 20;
const RADIUS = 72;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type HitKind = "perfect" | "good" | "ok" | "bad";
type Attempt = { elapsed: number; deviation: number; points: number; kind: HitKind };

function classify(deviation: number): HitKind {
  if (deviation <= 30) return "perfect";
  if (deviation <= 80) return "good";
  if (deviation <= 200) return "ok";
  return "bad";
}

function pointsFor(deviation: number) {
  if (deviation <= 20) return 1000;
  if (deviation <= 50) return 800;
  if (deviation <= 100) return 600;
  if (deviation <= 200) return 400;
  if (deviation <= 350) return 200;
  return 50;
}

const hitColor: Record<HitKind, string> = { perfect: "#34D399", good: "#7C6FFF", ok: "#F59E0B", bad: "#F87171" };
const hitLabel: Record<HitKind, string> = { perfect: "ИДЕАЛЬНО", good: "ХОРОШО", ok: "ПОЧТИ", bad: "МИМО" };

function IntroRule({ icon, color, children }: { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; children: React.ReactNode }) {
  return (
    <View style={styles.introRule}>
      <View style={[styles.introRuleIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.introRuleText}>{children}</Text>
    </View>
  );
}

export function OneSecondGame({ initialBestScore = 0, skin, challengeMode = false, attemptLimit = DEFAULT_CHALLENGE_ATTEMPTS, onExit, onComplete }: ArcadeGameProps) {
  const theme = resolveArcadeSkin(skin, "#7C6FFF", "#C9B8FF");
  const resultAccent = skin && skin.id !== "classic" ? theme.primary : "#34D399";
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [holding, setHolding] = useState(false);
  const [holdMs, setHoldMs] = useState(0);
  const [feedback, setFeedback] = useState<Attempt | null>(null);
  const [bestScore, setBestScore] = useState(initialBestScore);
  const pressStartedAt = useRef(0);
  const gameStartedAt = useRef(0);
  const finishing = useRef(false);
  const scale = useSharedValue(1);
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const challengeAttempts = Math.max(1, Math.min(100, Math.round(attemptLimit)));

  const score = useMemo(() => attempts.reduce((sum, item) => sum + item.points, 0), [attempts]);

  useEffect(() => {
    if (!holding) return;
    const timer = setInterval(() => setHoldMs(Date.now() - pressStartedAt.current), 16);
    return () => clearInterval(timer);
  }, [holding]);

  const start = useCallback(() => {
    finishing.current = false;
    setAttempts([]);
    setFeedback(null);
    setHolding(false);
    setHoldMs(0);
    gameStartedAt.current = Date.now();
    setPhase("playing");
  }, []);

  const finish = useCallback((finalAttempts: Attempt[]) => {
    if (finishing.current) return;
    finishing.current = true;
    const finalScore = finalAttempts.reduce((sum, item) => sum + item.points, 0);
    const average = Math.round(finalAttempts.reduce((sum, item) => sum + item.deviation, 0) / finalAttempts.length);
    const result: ArcadeGameResult = {
      gameId: GAME_ID,
      score: finalScore,
      won: average <= 250,
      durationMs: Date.now() - gameStartedAt.current,
      suggestedCoins: suggestedCoins(finalScore, average <= 250),
      stats: { averageDeviationMs: average, perfect: finalAttempts.filter((item) => item.kind === "perfect").length },
    };
    setBestScore((value) => Math.max(value, finalScore));
    setPhase("result");
    onComplete?.(result);
  }, [onComplete]);

  const pressIn = () => {
    if (feedback || holding) return;
    impact("light");
    pressStartedAt.current = Date.now();
    setHoldMs(0);
    setHolding(true);
    scale.set(withSpring(0.94, { damping: 18, stiffness: 280 }));
  };

  const pressOut = () => {
    if (!holding) return;
    const elapsed = Date.now() - pressStartedAt.current;
    const deviation = Math.abs(elapsed - TARGET_MS);
    const kind = classify(deviation);
    const nextAttempt = { elapsed, deviation, points: pointsFor(deviation), kind };
    const next = [...attempts, nextAttempt];
    setHolding(false);
    setHoldMs(elapsed);
    setFeedback(nextAttempt);
    setAttempts(next);
    scale.set(withSpring(1, { damping: 14, stiffness: 240 }));
    impact(kind === "perfect" ? "success" : kind === "bad" ? "error" : "medium");
    setTimeout(() => {
      setFeedback(null);
      setHoldMs(0);
      if (challengeMode && next.length >= challengeAttempts) finish(next);
    }, 780);
  };

  if (phase === "intro") {
    return (
      <GameRoot colors={["#121020", "#060608", "#06100E"]} skin={skin}>
        <GameHeader title="1 СЕКУНДА" accent={theme.primary} onExit={onExit} />
        <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(180)} style={styles.introScreen}>
          <Text style={styles.introOne}>1</Text>
          <Text style={[styles.introSecond, { color: theme.primary }]}>СЕКУНДА</Text>
          <Text style={styles.introKicker}>ТЕСТ ВНУТРЕННИХ ЧАСОВ МОЗГА</Text>
          <GlassPanel style={styles.rule}>
            <Text style={[styles.introTarget, { color: theme.primary }]}>1.000</Text>
            <Text style={styles.introTargetLabel}>ИДЕАЛЬНЫЙ РЕЗУЛЬТАТ</Text>
            <View style={styles.introDivider} />
            <IntroRule icon="radio-button-on" color="#FF5572">Нажми и <Text style={styles.introStrong}>держи</Text> кнопку</IntroRule>
            <IntroRule icon="stop" color={theme.secondary}>Отпусти ровно через <Text style={styles.introStrong}>1 секунду</Text></IntroRule>
            <IntroRule icon="repeat" color="#5CA8FF"><Text style={styles.introStrong}>{challengeMode ? `${challengeAttempts} попыток` : "Без ограничений"}</Text> — среднее отклонение решает</IntroRule>
            <IntroRule icon="trophy" color="#F5B800">Меньше <Text style={styles.introStrong}>30 мс</Text> — уровень мастера</IntroRule>
          </GlassPanel>
          <View style={styles.introStats}>
            <View style={styles.introStat}><Text style={styles.introStatLabel}>ЛУЧШЕЕ ОТКЛОНЕНИЕ</Text><Text style={styles.introStatValue}>—</Text></View>
            <View style={styles.introStat}><Text style={styles.introStatLabel}>ЛУЧШИЙ COIN</Text><Text style={styles.introStatValue}>{bestScore ? suggestedCoins(bestScore) : "—"}</Text></View>
          </View>
          <ArcadeButton accent={theme.primary} onPress={start} style={styles.introButton}>НАЧАТЬ</ArcadeButton>
        </Animated.View>
      </GameRoot>
    );
  }

  const average = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + item.deviation, 0) / attempts.length) : 0;
  if (phase === "result") {
    const grade = average <= 30 ? "ЛЕГЕНДА" : average <= 60 ? "МАСТЕР" : average <= 120 ? "ОТЛИЧНО" : average <= 250 ? "ХОРОШО" : "ТРЕНИРУЙСЯ";
    return <GameRoot colors={["#121020", "#060608", "#06100E"]} skin={skin}><GameHeader title="1 СЕКУНДА" accent={resultAccent} onExit={onExit} /><ResultScreen title={grade} score={score} accent={resultAccent} onRestart={start} onExit={onExit} stats={[{ label: "Отклонение", value: `${average} мс` }, { label: "Идеальных", value: attempts.filter((item) => item.kind === "perfect").length }, { label: "Рекорд", value: Math.max(bestScore, score) }]} /></GameRoot>;
  }

  const activeColor = feedback ? hitColor[feedback.kind] : holding ? theme.primary : "#FFFFFF";
  const progress = Math.min(holdMs / TARGET_MS, 1);
  return (
    <GameRoot colors={["#121020", "#060608", "#06100E"]} skin={skin}>
      <GameHeader title="1 СЕКУНДА" accent={theme.primary} onExit={onExit} right={<Text style={styles.best}>COIN {bestScore ? suggestedCoins(bestScore) : "—"}</Text>} />
      <View style={styles.hud}><HudStat label="Попытка" value={challengeMode ? `${attempts.length + (feedback ? 0 : 1)}/${challengeAttempts}` : `${attempts.length + (feedback ? 0 : 1)}/∞`} /><HudStat label="COIN" value={suggestedCoins(score)} color={theme.primary} /><HudStat label="Среднее" value={attempts.length ? `${average}мс` : "—"} /></View>
      <View style={styles.game}>
        <Text style={[styles.phase, { color: activeColor }]}>{feedback ? hitLabel[feedback.kind] : holding ? "ОТПУСТИ ЧЕРЕЗ 1 СЕКУНДУ" : "НАЖМИ И ДЕРЖИ"}</Text>
        <Pressable onPressIn={pressIn} onPressOut={pressOut} accessibilityRole="button" accessibilityLabel="Зажмите и отпустите через одну секунду">
          <Animated.View style={[styles.circleWrap, buttonStyle]}>
            <Svg width={176} height={176} style={StyleSheet.absoluteFill}>
              <Circle cx={88} cy={88} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={4} />
              <Circle cx={88} cy={88} r={RADIUS} fill="none" stroke={activeColor} strokeWidth={5} strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - progress)} transform="rotate(-90 88 88)" />
            </Svg>
            <View style={[styles.circle, { borderColor: `${activeColor}55` }]}>
              <Text style={[styles.circleLabel, { color: activeColor }]}>{feedback ? `${feedback.elapsed >= TARGET_MS ? "+" : "−"}${feedback.deviation}мс` : holding ? "ДЕРЖИ" : "СТАРТ"}</Text>
              <Text style={styles.circleValue}>{feedback ? (feedback.elapsed / 1000).toFixed(3) : "1.0"}</Text>
              {feedback ? <Animated.Text entering={FadeIn} style={[styles.points, { color: activeColor }]}>{suggestedCoins(score)} coin</Animated.Text> : null}
            </View>
          </Animated.View>
        </Pressable>
        <View style={styles.deviation}><Text style={styles.deviationLabel}>−500 мс</Text><View style={styles.deviationLine}><View style={styles.deviationCenter} /></View><Text style={styles.deviationLabel}>+500 мс</Text></View>
      </View>
      {challengeMode ? <><ProgressBar progress={attempts.length / challengeAttempts} color={theme.primary} height={6} /><View style={styles.dots}>{Array.from({ length: challengeAttempts }, (_, index) => <View key={index} style={[styles.dot, attempts[index] && { backgroundColor: hitColor[attempts[index]!.kind] }]} />)}</View></> : attempts.length > 0 && !holding ? <ArcadeButton accent={theme.primary} onPress={() => finish(attempts)} style={styles.finishButton}>ЗАВЕРШИТЬ</ArcadeButton> : null}
    </GameRoot>
  );
}

const styles = StyleSheet.create({
  introScreen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingBottom: 16, gap: 8 },
  introOne: { color: "#FFFFFF", fontSize: 74, lineHeight: 74, fontWeight: "900", letterSpacing: -4 },
  introSecond: { color: "#8E7CFF", fontSize: 14, lineHeight: 18, fontWeight: "800", letterSpacing: 6 },
  introKicker: { color: "rgba(255,255,255,0.35)", fontSize: 8, lineHeight: 12, fontWeight: "700", letterSpacing: 2.3, marginBottom: 6 },
  rule: { width: "100%", maxWidth: 340, gap: 9, paddingVertical: 14, paddingHorizontal: 16 },
  introTarget: { color: "#7C6FFF", fontSize: 44, lineHeight: 46, fontWeight: "900", textAlign: "center", letterSpacing: -1.5 },
  introTargetLabel: { color: "rgba(255,255,255,0.3)", fontSize: 7, lineHeight: 10, fontWeight: "800", textAlign: "center", letterSpacing: 2 },
  introDivider: { width: "100%", height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 2 },
  introRule: { minHeight: 30, flexDirection: "row", alignItems: "center", gap: 10 },
  introRuleIcon: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  introRuleText: { flex: 1, color: "rgba(255,255,255,0.56)", fontSize: 11, lineHeight: 16 },
  introStrong: { color: "#FFFFFF", fontWeight: "900" },
  introStats: { width: "100%", maxWidth: 300, flexDirection: "row", gap: 18, marginTop: 2 },
  introStat: { flex: 1, alignItems: "center", gap: 3 },
  introStatLabel: { color: "rgba(255,255,255,0.28)", fontSize: 6, lineHeight: 9, fontWeight: "800", letterSpacing: 1.6, textAlign: "center" },
  introStatValue: { color: "#34D399", fontSize: 20, lineHeight: 22, fontWeight: "900" },
  introButton: { width: "100%", maxWidth: 300, marginTop: 2 },
  best: { color: "rgba(255,255,255,0.42)", fontSize: 9, fontWeight: "900" },
  hud: { flexDirection: "row", gap: 8 },
  game: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  phase: { fontSize: 10, fontWeight: "900", letterSpacing: 2.4, textAlign: "center" },
  circleWrap: { width: 176, height: 176, alignItems: "center", justifyContent: "center" },
  circle: { width: 150, height: 150, borderRadius: 75, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.055)", alignItems: "center", justifyContent: "center", gap: 4 },
  circleLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  circleValue: { color: "#FFFFFF", fontSize: 39, fontWeight: "900", fontVariant: ["tabular-nums"] },
  points: { fontSize: 11, fontWeight: "900" },
  deviation: { width: 220, flexDirection: "row", alignItems: "center", gap: 8 },
  deviationLine: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center" },
  deviationCenter: { width: 2, height: 8, marginTop: -2, backgroundColor: "rgba(255,255,255,0.35)" },
  deviationLabel: { color: "rgba(255,255,255,0.25)", fontSize: 8 },
  dots: { minHeight: 50, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignContent: "center", gap: 6, paddingVertical: 12 },
  finishButton: { width: "100%", maxWidth: 260, alignSelf: "center", marginBottom: 12 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.12)" },
});

export default OneSecondGame;
