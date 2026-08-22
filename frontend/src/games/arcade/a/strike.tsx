import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { ZoomIn, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { GameHeader, GameRoot, HudStat, IntroScreen, ProgressBar, ResultScreen, impact, resolveArcadeSkin } from "./primitives";
import type { ArcadeGameProps } from "./types";
import { suggestedCoins } from "./utils";

const GAME_ID = "strike" as const;
const TOTAL = 38;
type Hit = "perfect" | "good" | "ok" | "miss";
const COLORS: Record<Hit, string> = { perfect: "#20E67A", good: "#FFD43B", ok: "#FF8A31", miss: "#FF2D2D" };
const LABELS: Record<Hit, string> = { perfect: "PERFECT", good: "GOOD", ok: "OK", miss: "MISS" };
const BASE_POINTS: Record<Hit, number> = { perfect: 1000, good: 500, ok: 150, miss: 0 };
const MULTIPLIERS = [1, 1, 1.5, 2, 2.5, 3];

function speedFor(attempt: number) {
  if (attempt <= 6) return 0.35 + 0.2 * ((attempt - 1) / 5);
  if (attempt <= 14) return 0.55 + 0.55 * ((attempt - 6) / 8);
  if (attempt <= 23) return 1.1 + 0.1 * ((attempt - 14) / 9);
  if (attempt <= 32) return 1.2 + 0.5 * ((attempt - 23) / 9);
  return 1.7 + 0.3 * ((attempt - 32) / 6);
}

function classify(position: number): Hit {
  const distance = Math.abs(position - 0.5);
  if (distance <= 0.08) return "perfect";
  if (distance <= 0.16) return "good";
  if (distance <= 0.28) return "ok";
  return "miss";
}

export function StrikeGame({ initialBestScore = 0, skin, onExit, onComplete }: ArcadeGameProps) {
  const theme = resolveArcadeSkin(skin, "#FF2D2D", "#F0C040");
  const resultAccent = skin && skin.id !== "classic" ? theme.primary : "#F0C040";
  const tapAccent = skin && skin.id !== "classic" ? theme.secondary : "#F5F5F0";
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [position, setPosition] = useState(0);
  const [hits, setHits] = useState<Hit[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [feedback, setFeedback] = useState<{ hit: Hit; points: number } | null>(null);
  const [best, setBest] = useState(initialBestScore);
  const direction = useRef(1);
  const lastFrame = useRef(0);
  const gameStartedAt = useRef(0);
  const canTap = useRef(false);
  const finishing = useRef(false);
  const buttonScale = useSharedValue(1);
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.value }] }));

  const currentSpeed = speedFor(hits.length + 1);
  useEffect(() => {
    if (phase !== "playing") return;
    lastFrame.current = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const delta = Math.min((now - lastFrame.current) / 1000, 0.05);
      lastFrame.current = now;
      setPosition((value) => {
        let next = value + direction.current * currentSpeed * delta;
        if (next >= 1) { next = 1; direction.current = -1; }
        if (next <= 0) { next = 0; direction.current = 1; }
        return next;
      });
    }, 16);
    return () => clearInterval(timer);
  }, [currentSpeed, phase]);

  const start = useCallback(() => {
    finishing.current = false; canTap.current = true; direction.current = 1; gameStartedAt.current = Date.now();
    setHits([]); setScore(0); setCombo(0); setMaxCombo(0); setPosition(0); setFeedback(null); setPhase("playing");
  }, []);

  const finish = useCallback((finalHits: Hit[], finalScore: number, finalMaxCombo: number) => {
    if (finishing.current) return;
    finishing.current = true; canTap.current = false;
    const perfect = finalHits.filter((hit) => hit === "perfect").length;
    const won = finalHits.filter((hit) => hit !== "miss").length >= 28;
    setBest((value) => Math.max(value, finalScore));
    setPhase("result");
    onComplete?.({ gameId: GAME_ID, score: finalScore, won, durationMs: Date.now() - gameStartedAt.current, suggestedCoins: suggestedCoins(finalScore, won), stats: { perfect, maxCombo: finalMaxCombo, attempts: finalHits.length } });
  }, [onComplete]);

  const tap = () => {
    if (!canTap.current || feedback) return;
    canTap.current = false;
    const hit = classify(position);
    const nextCombo = hit === "miss" ? 0 : combo + 1;
    const nextMax = Math.max(maxCombo, nextCombo);
    const multiplier = MULTIPLIERS[Math.min(nextCombo, MULTIPLIERS.length - 1)] ?? 3;
    const points = Math.round(BASE_POINTS[hit] * multiplier);
    const nextScore = score + points;
    const nextHits = [...hits, hit];
    setHits(nextHits); setScore(nextScore); setCombo(nextCombo); setMaxCombo(nextMax); setFeedback({ hit, points });
    buttonScale.set(withSequence(withTiming(0.94, { duration: 70 }), withTiming(1, { duration: 150 })));
    impact(hit === "perfect" ? "success" : hit === "miss" ? "error" : "medium");
    setTimeout(() => {
      setFeedback(null);
      if (nextHits.length >= TOTAL) finish(nextHits, nextScore, nextMax);
      else canTap.current = true;
    }, 520);
  };

  if (phase === "intro") return <GameRoot colors={["#160D0D", "#080808", "#0B0B0B"]} skin={skin}><GameHeader title="УДАР" accent={theme.primary} onExit={onExit} /><IntroScreen eyebrow="TIMING IS EVERYTHING" title="УДАР" subtitle="Останови стрелку в самом центре. Скорость будет расти после каждого удара." accent={tapAccent} onStart={start}><View style={styles.zoneLegend}>{(["perfect", "good", "ok", "miss"] as Hit[]).map((hit) => <View key={hit} style={[styles.legendChip, { borderColor: COLORS[hit] }]}><Text style={[styles.legendText, { color: COLORS[hit] }]}>{LABELS[hit]}</Text></View>)}</View></IntroScreen></GameRoot>;

  const perfect = hits.filter((hit) => hit === "perfect").length;
  if (phase === "result") {
    const grade = perfect >= 30 ? "ИДЕАЛЬНО" : perfect >= 22 ? "ОТЛИЧНО" : hits.filter((hit) => hit !== "miss").length >= 28 ? "ХОРОШО" : "ПРОМАХ";
    return <GameRoot colors={["#160D0D", "#080808", "#0B0B0B"]} skin={skin}><GameHeader title="УДАР" accent={resultAccent} onExit={onExit} /><ResultScreen title={grade} score={score} accent={resultAccent} onRestart={start} onExit={onExit} stats={[{ label: "Perfect", value: perfect }, { label: "Комбо", value: maxCombo }, { label: "Рекорд", value: Math.max(best, score) }]} /></GameRoot>;
  }

  const multiplier = MULTIPLIERS[Math.min(combo, MULTIPLIERS.length - 1)] ?? 3;
  return (
    <GameRoot colors={["#160D0D", "#080808", "#0B0B0B"]} skin={skin}>
      <GameHeader title="УДАР" accent={theme.primary} onExit={onExit} right={<Text style={[styles.speed, { color: theme.secondary }]}>×{currentSpeed.toFixed(1)}</Text>} />
      <View style={styles.hud}><HudStat label="COIN" value={suggestedCoins(score)} color={theme.secondary} /><HudStat label="Комбо" value={`×${multiplier}`} /><HudStat label="Попытка" value={`${hits.length + 1}/${TOTAL}`} /></View>
      <View style={styles.attempts}>{Array.from({ length: TOTAL }, (_, index) => <View key={index} style={[styles.attempt, hits[index] && { backgroundColor: COLORS[hits[index]!] }]} />)}</View>
      <View style={styles.stage}>
        <Text style={[styles.status, feedback && { color: COLORS[feedback.hit] }]}>{feedback ? LABELS[feedback.hit] : "НАЖМИ В НУЖНЫЙ МОМЕНТ"}</Text>
        <View style={styles.track}>
          <LinearGradient
            pointerEvents="none"
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            locations={[0, 0.18, 0.35, 0.5, 0.65, 0.82, 1]}
            colors={[
              "rgba(255,45,45,0.34)",
              "rgba(255,80,42,0.46)",
              "rgba(255,212,59,0.55)",
              "rgba(32,230,122,0.82)",
              "rgba(255,212,59,0.55)",
              "rgba(255,80,42,0.46)",
              "rgba(255,45,45,0.34)",
            ]}
            style={styles.timingAura}
          />
          <View pointerEvents="none" style={styles.centerGlow} />
          <View style={styles.centerLine} />
          <View style={[styles.needle, { left: `${position * 100}%` as `${number}%` }, feedback && { backgroundColor: COLORS[feedback.hit], shadowColor: COLORS[feedback.hit] }]} />
        </View>
        <View style={styles.trackLabels}><Text style={styles.trackLabel}>MISS</Text><Text style={[styles.trackLabel, { color: theme.secondary }]}>PERFECT</Text><Text style={styles.trackLabel}>MISS</Text></View>
        {feedback ? <Animated.View entering={ZoomIn.springify()} style={styles.scorePop}><Text style={[styles.scorePopText, { color: COLORS[feedback.hit] }]}>+{feedback.points}</Text></Animated.View> : <Text style={styles.bigScore}>{score}</Text>}
        <View style={styles.multiplierRow}><Text style={styles.multLabel}>СКОРОСТЬ</Text><ProgressBar progress={(currentSpeed - 0.35) / 1.65} color={theme.primary} /><Text style={styles.multLabel}>×{currentSpeed.toFixed(1)}</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Удар" onPress={tap} style={styles.tapWrap}><Animated.View style={[styles.tapButton, { backgroundColor: tapAccent, shadowColor: theme.primary }, buttonStyle]}><Text style={styles.tapText}>УДАР</Text></Animated.View></Pressable>
    </GameRoot>
  );
}

const styles = StyleSheet.create({
  zoneLegend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 7 },
  legendChip: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "rgba(255,255,255,0.04)" },
  legendText: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  speed: { color: "#F0C040", fontSize: 13, fontWeight: "900" },
  hud: { flexDirection: "row", gap: 8 },
  attempts: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4, paddingVertical: 14 },
  attempt: { width: 18, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.10)" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  status: { color: "rgba(255,255,255,0.48)", fontSize: 11, fontWeight: "900", letterSpacing: 2.5 },
  track: { width: "100%", maxWidth: 600, height: 62, borderRadius: 14, backgroundColor: "#111111", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", overflow: "hidden", position: "relative", shadowColor: "#20E67A", shadowOpacity: 0.32, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  timingAura: { ...StyleSheet.absoluteFill, opacity: 0.9 },
  centerGlow: { position: "absolute", left: "42%", width: "16%", top: -18, bottom: -18, borderRadius: 999, backgroundColor: "rgba(100,255,170,0.26)", shadowColor: "#20E67A", shadowOpacity: 0.95, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  centerLine: { position: "absolute", left: "50%", top: 6, bottom: 6, width: 2, backgroundColor: "#FFFFFF", opacity: 0.65 },
  needle: { position: "absolute", top: 4, bottom: 4, width: 5, marginLeft: -2.5, borderRadius: 3, backgroundColor: "#FFFFFF", shadowColor: "#FFFFFF", shadowOpacity: 0.8, shadowRadius: 8 },
  trackLabels: { width: "100%", maxWidth: 600, flexDirection: "row", justifyContent: "space-between", marginTop: -14 },
  trackLabel: { color: "rgba(255,255,255,0.24)", fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  bigScore: { color: "#FFFFFF", fontSize: 62, fontWeight: "900", fontVariant: ["tabular-nums"] },
  scorePop: { minHeight: 74, justifyContent: "center" },
  scorePopText: { fontSize: 48, fontWeight: "900" },
  multiplierRow: { width: "100%", maxWidth: 320, flexDirection: "row", alignItems: "center", gap: 10 },
  multLabel: { color: "rgba(255,255,255,0.36)", fontSize: 9, fontWeight: "900" },
  tapWrap: { paddingVertical: 18 },
  tapButton: { minHeight: 76, borderRadius: 20, backgroundColor: "#F5F5F0", alignItems: "center", justifyContent: "center", shadowColor: "#FFFFFF", shadowOpacity: 0.12, shadowRadius: 18 },
  tapText: { color: "#080808", fontSize: 30, fontWeight: "900", letterSpacing: 5 },
});

export default StrikeGame;
