import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { ArcadeButton, GameHeader, GameRoot, HudStat, IntroScreen, LivesStat, ProgressBar, ResultScreen, impact, resolveArcadeSkin } from "./primitives";
import type { ArcadeGameProps } from "./types";
import { formatClock, nowMs, shuffle, suggestedCoins } from "./utils";
import { usePauseClock } from "@/games/pause-clock";

const GAME_ID = "find-number" as const;
const LEVELS = [
  { name: "МЕРКУРИЙ", columns: 4, count: 16, seconds: 58 },
  { name: "ВЕНЕРА", columns: 4, count: 16, seconds: 49 },
  { name: "ЗЕМЛЯ", columns: 4, count: 16, seconds: 39 },
  { name: "МАРС", columns: 4, count: 16, seconds: 32 },
  { name: "ЮПИТЕР", columns: 5, count: 25, seconds: 51 },
  { name: "САТУРН", columns: 5, count: 25, seconds: 42 },
  { name: "УРАН", columns: 5, count: 25, seconds: 32 },
  { name: "НЕПТУН", columns: 6, count: 36, seconds: 71 },
] as const;

export function FindNumberGame({ initialBestScore = 0, paused = false, skin, onExit, onComplete }: ArcadeGameProps) {
  const theme = resolveArcadeSkin(skin, "#00FFE0", "#7B5FFF");
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<"intro" | "playing" | "level" | "result">("intro");
  const [levelIndex, setLevelIndex] = useState(0);
  const [numbers, setNumbers] = useState<number[]>([]);
  const [current, setCurrent] = useState(1);
  const [found, setFound] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [feedback, setFeedback] = useState<{ value: number; ok: boolean } | null>(null);
  const [best, setBest] = useState(initialBestScore);
  const gameStartedAt = useRef(0);
  const levelDeadline = useRef(0);
  const finishing = useRef(false);
  usePauseClock(paused, [gameStartedAt, levelDeadline]);
  const level = LEVELS[levelIndex]!;

  const loadLevel = useCallback((index: number) => {
    const next = LEVELS[index]!;
    setLevelIndex(index); setNumbers(shuffle(Array.from({ length: next.count }, (_, item) => item + 1))); setCurrent(1); setFound([]); setCombo(0); setTimeLeft(next.seconds * 1000); setFeedback(null);
    levelDeadline.current = Date.now() + next.seconds * 1000;
    setPhase("playing");
  }, []);

  const start = useCallback(() => {
    finishing.current = false; gameStartedAt.current = Date.now(); setScore(0); setLives(3); setElapsedMs(0); loadLevel(0);
  }, [loadLevel]);

  const finish = useCallback((won: boolean, finalScore = score, finalLives = lives) => {
    if (finishing.current) return;
    finishing.current = true;
    const duration = Date.now() - gameStartedAt.current;
    setElapsedMs(duration); setBest((value) => Math.max(value, finalScore)); setPhase("result");
    onComplete?.({ gameId: GAME_ID, score: finalScore, won, durationMs: duration, suggestedCoins: suggestedCoins(finalScore, won), stats: { level: levelIndex + 1, lives: finalLives, elapsedMs: duration } });
  }, [levelIndex, lives, onComplete, score]);

  useEffect(() => {
    if (phase !== "playing" || paused) return;
    const timer = setInterval(() => {
      const next = Math.max(0, levelDeadline.current - Date.now());
      setTimeLeft(next); setElapsedMs(Date.now() - gameStartedAt.current);
      if (next <= 0) finish(false);
    }, 100);
    return () => clearInterval(timer);
  }, [finish, paused, phase]);

  const choose = (value: number) => {
    if (phase !== "playing" || found.includes(value) || feedback) return;
    if (value === current) {
      const nextCombo = combo + 1;
      const nextScore = score + 10 * nextCombo;
      const nextFound = [...found, value];
      setCombo(nextCombo); setScore(nextScore); setFound(nextFound); setCurrent(value + 1); setFeedback({ value, ok: true }); impact("success");
      setTimeout(() => setFeedback(null), 220);
      if (nextFound.length === level.count) {
        levelDeadline.current = nowMs() + 60_000;
        const finalLevelScore = nextScore + Math.floor(timeLeft / 1000) * 2;
        setScore(finalLevelScore);
        setTimeout(() => setPhase("level"), 420);
      }
    } else {
      const nextLives = lives - 1;
      setLives(nextLives); setCombo(0); setFeedback({ value, ok: false }); impact("error");
      setTimeout(() => setFeedback(null), 300);
      if (nextLives <= 0) setTimeout(() => finish(false, score, nextLives), 320);
    }
  };

  const continueLevel = () => {
    if (levelIndex >= LEVELS.length - 1) finish(true);
    else loadLevel(levelIndex + 1);
  };

  if (phase === "intro") return <GameRoot colors={["#151149", "#030A1A", "#031425"]} skin={skin}><GameHeader title="КОСМОС" accent={theme.primary} onExit={onExit} /><IntroScreen eyebrow="НАЙДИ ЧИСЛО" title="КОСМОС" subtitle="Найди все числа по порядку. Восемь планет, три жизни и всё меньше времени." accent={theme.primary} onStart={start}><View style={styles.featureRow}><Text style={styles.feature}>8 УРОВНЕЙ</Text><Text style={styles.feature}>3 ЖИЗНИ</Text><Text style={styles.feature}>КОМБО</Text></View></IntroScreen></GameRoot>;

  if (phase === "result") return <GameRoot colors={["#151149", "#030A1A", "#031425"]} skin={skin}><GameHeader title="КОСМОС" accent={theme.primary} onExit={onExit} /><ResultScreen title={levelIndex >= LEVELS.length - 1 && found.length === level.count ? "ГАЛАКТИКА ПОКОРЕНА" : "МИССИЯ ЗАВЕРШЕНА"} score={score} accent={theme.primary} onRestart={start} onExit={onExit} stats={[{ label: "Уровень", value: levelIndex + 1 }, { label: "Время", value: formatClock(elapsedMs) }, { label: "Рекорд", value: Math.max(best, score) }]} /></GameRoot>;

  if (phase === "level") return <GameRoot colors={["#151149", "#030A1A", "#031425"]} skin={skin}><GameHeader title="КОСМОС" accent={theme.primary} onExit={onExit} /><Animated.View entering={ZoomIn.springify()} style={styles.levelScreen}><Ionicons name="planet-outline" color={theme.primary} size={64} /><Text style={styles.levelTitle}>{level.name}</Text><Text style={styles.levelSubtitle}>УРОВЕНЬ ПРОЙДЕН</Text><Text style={styles.levelScore}>{suggestedCoins(score)} coin</Text><ArcadeButton accent={theme.primary} onPress={continueLevel} style={styles.nextButton}>{levelIndex >= LEVELS.length - 1 ? "ФИНИШ" : "ДАЛЬШЕ"}</ArcadeButton></Animated.View></GameRoot>;

  const maxGrid = Math.min(width - 32, height * 0.53, 500);
  const gap = level.columns >= 6 ? 5 : 8;
  const cellSize = Math.floor((maxGrid - gap * (level.columns - 1)) / level.columns);
  return (
    <GameRoot colors={["#151149", "#030A1A", "#031425"]} skin={skin}>
      <GameHeader title="КОСМОС" accent={theme.primary} onExit={onExit} right={<Text style={[styles.countdown, timeLeft <= 10_000 && styles.danger]}>{Math.ceil(timeLeft / 1000)}</Text>} />
      <View style={styles.hud}><LivesStat lives={lives} color="#FF5572" /><HudStat label="COIN" value={suggestedCoins(score)} color={theme.primary} /><HudStat label="Время" value={formatClock(elapsedMs)} color={theme.secondary} /></View>
      <View style={styles.prompt}><Text style={styles.promptLabel}>НАЙДИ ПЛАНЕТУ</Text><Text style={styles.target}>{current}</Text><Text style={styles.levelBadge}>{levelIndex + 1} · {level.name}</Text></View>
      <ProgressBar progress={found.length / level.count} color={theme.primary} />
      <View style={styles.gridStage}>
        <View style={[styles.grid, { width: cellSize * level.columns + gap * (level.columns - 1), gap }]}>{numbers.map((value) => {
          const isFound = found.includes(value);
          const isFeedback = feedback?.value === value;
          return <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Число ${value}`} onPress={() => choose(value)} disabled={isFound} style={({ pressed }) => [styles.cell, { width: cellSize, height: cellSize, borderRadius: level.columns >= 6 ? 9 : 13 }, isFound && styles.cellFound, isFeedback && (feedback.ok ? styles.cellCorrect : styles.cellWrong), pressed && styles.cellPressed]}><Text style={[styles.cellText, { fontSize: Math.max(12, cellSize * 0.28) }, isFound && styles.cellTextFound]}>{value}</Text></Pressable>;
        })}</View>
      </View>
      <ProgressBar progress={timeLeft / (level.seconds * 1000)} color={timeLeft <= 10_000 ? "#FF3250" : theme.secondary} />
    </GameRoot>
  );
}

const styles = StyleSheet.create({
  featureRow: { flexDirection: "row", gap: 8 },
  feature: { color: "rgba(255,255,255,0.62)", fontSize: 9, fontWeight: "900", letterSpacing: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)" },
  countdown: { color: "#00FFE0", fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] },
  danger: { color: "#FF3250" },
  hud: { flexDirection: "row", gap: 8 },
  prompt: { alignItems: "center", marginVertical: 10, paddingVertical: 8 },
  promptLabel: { color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: "900", letterSpacing: 2.2 },
  target: { color: "#FFFFFF", fontSize: 42, lineHeight: 46, fontWeight: "900", textShadowColor: "#7B5FFF", textShadowRadius: 18 },
  levelBadge: { color: "#FFD700", fontSize: 9, fontWeight: "800", letterSpacing: 1.8 },
  gridStage: { flex: 1, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(12,38,82,0.78)", borderWidth: 1, borderColor: "rgba(0,255,224,0.18)" },
  cellPressed: { transform: [{ scale: 0.94 }], backgroundColor: "rgba(20,60,140,0.9)" },
  cellFound: { backgroundColor: "rgba(0,255,160,0.07)", borderColor: "rgba(0,255,160,0.16)" },
  cellCorrect: { backgroundColor: "rgba(0,255,160,0.24)", borderColor: "#00FFE0", transform: [{ scale: 1.08 }] },
  cellWrong: { backgroundColor: "rgba(255,50,80,0.30)", borderColor: "#FF3250" },
  cellText: { color: "#E8F4FF", fontWeight: "900", fontVariant: ["tabular-nums"] },
  cellTextFound: { color: "rgba(0,255,160,0.34)" },
  levelScreen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 9 },
  levelTitle: { color: "#FFFFFF", fontSize: 42, fontWeight: "900" },
  levelSubtitle: { color: "#00FFE0", fontSize: 11, fontWeight: "900", letterSpacing: 3 },
  levelScore: { color: "#FFD700", fontSize: 50, fontWeight: "900", marginVertical: 10 },
  nextButton: { width: "100%", maxWidth: 330 },
});

export default FindNumberGame;
