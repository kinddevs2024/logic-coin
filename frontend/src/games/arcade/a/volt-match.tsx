import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeInDown, ZoomIn, ZoomOut } from "react-native-reanimated";

import { ArcadeButton, GameHeader, GameRoot, HudStat, IntroScreen, ProgressBar, ResultScreen, impact, resolveArcadeSkin } from "./primitives";
import type { ArcadeGameProps } from "./types";
import { formatClock, randomInt, shuffle, suggestedCoins } from "./utils";
import { usePauseClock } from "@/games/pause-clock";

const GAME_ID = "volt-match" as const;
const TOTAL_ROUNDS = 12;
type IoniconName = ComponentProps<typeof Ionicons>["name"];
type MatchIcon = { icon: IoniconName; name: string; colors: readonly [string, string, string] };
const ICONS = [
  { icon: "balloon-outline", name: "ШАРИК", colors: ["#93C5FD", "#2563EB", "#1E3A8A"] }, { icon: "fast-food-outline", name: "БУРГЕР", colors: ["#86EFAC", "#16A34A", "#052E16"] },
  { icon: "alarm-outline", name: "БУДИЛЬНИК", colors: ["#FCA5A5", "#DC2626", "#7F1D1D"] }, { icon: "bulb-outline", name: "ИДЕЯ", colors: ["#FDE68A", "#D97706", "#451A03"] },
  { icon: "water-outline", name: "КАПЛЯ", colors: ["#FCA5A5", "#E11D48", "#500724"] }, { icon: "glasses-outline", name: "ОЧКИ", colors: ["#5EEAD4", "#0D9488", "#042F2E"] },
  { icon: "bed-outline", name: "КРОВАТЬ", colors: ["#7DD3FC", "#0284C7", "#082F49"] }, { icon: "moon-outline", name: "ЛУНА", colors: ["#818CF8", "#4338CA", "#1E1B4B"] },
  { icon: "train-outline", name: "ПОЕЗД", colors: ["#6EE7B7", "#059669", "#022C22"] }, { icon: "paw-outline", name: "ЛАПА", colors: ["#FDE68A", "#B45309", "#451A03"] },
  { icon: "rocket-outline", name: "РАКЕТА", colors: ["#C4B5FD", "#7C3AED", "#2E1065"] }, { icon: "game-controller-outline", name: "ДЖОЙСТИК", colors: ["#FB923C", "#EA580C", "#431407"] },
  { icon: "football-outline", name: "МЯЧ", colors: ["#D1FAE5", "#065F46", "#022C22"] }, { icon: "flower-outline", name: "ЦВЕТОК", colors: ["#FBCFE8", "#BE185D", "#500724"] },
  { icon: "fish-outline", name: "РЫБА", colors: ["#7DD3FC", "#0369A1", "#0C4A6E"] }, { icon: "color-filter-outline", name: "ФИЛЬТР", colors: ["#E9D5FF", "#7C3AED", "#2E1065"] },
  { icon: "pizza-outline", name: "ПИЦЦА", colors: ["#FEF08A", "#CA8A04", "#422006"] }, { icon: "musical-notes-outline", name: "МУЗЫКА", colors: ["#FCD34D", "#92400E", "#1C0A00"] },
  { icon: "flame-outline", name: "ОГОНЬ", colors: ["#86EFAC", "#15803D", "#052E16"] }, { icon: "flash-outline", name: "МОЛНИЯ", colors: ["#FDE68A", "#CA8A04", "#422006"] },
  { icon: "locate-outline", name: "МИШЕНЬ", colors: ["#FCA5A5", "#B91C1C", "#450A0A"] }, { icon: "rainy-outline", name: "ВОЛНА", colors: ["#7DD3FC", "#1D4ED8", "#1E3A8A"] },
  { icon: "leaf-outline", name: "ЛИСТ", colors: ["#FED7AA", "#C2410C", "#431407"] }, { icon: "happy-outline", name: "УЛЫБКА", colors: ["#A78BFA", "#7C3AED", "#3B0764"] },
] as const satisfies readonly MatchIcon[];
type Cell = { id: number; iconIndex: number; target: boolean; removed: boolean };

function roundDuration(round: number) { return Math.max(2, 7 - Math.max(0, round - 6) * 0.3); }

export function VoltMatchGame({ initialBestScore = 0, paused = false, skin, onExit, onComplete }: ArcadeGameProps) {
  const theme = resolveArcadeSkin(skin, "#F5C842", "#C084FC");
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<"intro" | "playing" | "round" | "result">("intro");
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [correctTaps, setCorrectTaps] = useState(0);
  const [wrongTaps, setWrongTaps] = useState(0);
  const [targetIndex, setTargetIndex] = useState(0);
  const [cells, setCells] = useState<Cell[]>([]);
  const [remainingTargets, setRemainingTargets] = useState(0);
  const [timeLeft, setTimeLeft] = useState(7_000);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [roundWon, setRoundWon] = useState(true);
  const [best, setBest] = useState(initialBestScore);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const deadline = useRef(0);
  const startedAt = useRef(0);
  const canTap = useRef(false);
  const finishing = useRef(false);
  usePauseClock(paused, [deadline, startedAt]);
  const usedTargets = useRef<number[]>([]);

  const buildRound = useCallback((roundNumber: number) => {
    const available = ICONS.map((_, index) => index).filter((index) => !usedTargets.current.slice(-8).includes(index));
    const iconIndex = (available.length ? available : ICONS.map((_, index) => index))[randomInt(0, (available.length ? available : ICONS).length - 1)]!;
    usedTargets.current.push(iconIndex);
    const copies = 3 + randomInt(0, 1);
    const positions = new Set<number>();
    while (positions.size < copies) positions.add(randomInt(0, 24));
    const otherIcons = shuffle(ICONS.map((_, index) => index).filter((index) => index !== iconIndex));
    let cursor = 0;
    const nextCells = Array.from({ length: 25 }, (_, id): Cell => ({ id, iconIndex: positions.has(id) ? iconIndex : otherIcons[cursor++ % otherIcons.length]!, target: positions.has(id), removed: false }));
    const duration = roundDuration(roundNumber) * 1000;
    setRound(roundNumber); setTargetIndex(iconIndex); setCells(nextCells); setRemainingTargets(copies); setRoundScore(0); setRoundWon(true); setFeedback(null); setTimeLeft(duration);
    deadline.current = Date.now() + duration; canTap.current = true; setPhase("playing");
  }, []);

  const start = useCallback(() => {
    finishing.current = false; canTap.current = false; usedTargets.current = []; startedAt.current = Date.now();
    setScore(0); setCombo(0); setMaxCombo(0); setMistakes(0); setCorrectTaps(0); setWrongTaps(0); setElapsedMs(0); buildRound(1);
  }, [buildRound]);

  const finish = useCallback((final?: { score?: number; mistakes?: number; correct?: number; wrong?: number; maxCombo?: number; round?: number }) => {
    if (finishing.current) return;
    finishing.current = true; canTap.current = false;
    const finalScore = final?.score ?? score; const finalMistakes = final?.mistakes ?? mistakes; const finalCorrect = final?.correct ?? correctTaps; const finalWrong = final?.wrong ?? wrongTaps; const finalCombo = final?.maxCombo ?? maxCombo; const finalRound = final?.round ?? round;
    const duration = Date.now() - startedAt.current; const accuracy = Math.round((finalCorrect / Math.max(1, finalCorrect + finalWrong)) * 100); const won = finalRound >= TOTAL_ROUNDS && finalMistakes < 3;
    setElapsedMs(duration); setBest((value) => Math.max(value, finalScore)); setPhase("result");
    onComplete?.({ gameId: GAME_ID, score: finalScore, won, durationMs: duration, suggestedCoins: suggestedCoins(finalScore, won), stats: { rounds: finalRound, mistakes: finalMistakes, correct: finalCorrect, accuracy, maxCombo: finalCombo } });
  }, [correctTaps, maxCombo, mistakes, onComplete, round, score, wrongTaps]);

  useEffect(() => {
    if (phase !== "playing" || paused) return;
    const timer = setInterval(() => {
      const next = Math.max(0, deadline.current - Date.now()); setTimeLeft(next); setElapsedMs(Date.now() - startedAt.current);
      if (next <= 0 && canTap.current) { canTap.current = false; setRoundWon(false); setFeedback("wrong"); impact("error"); setTimeout(() => setPhase("round"), 360); }
    }, 50);
    return () => clearInterval(timer);
  }, [paused, phase]);

  const choose = (cell: Cell) => {
    if (!canTap.current || cell.removed) return;
    if (cell.target) {
      const nextCombo = combo + 1; const multiplier = Math.min(nextCombo, 6); const speedBonus = Math.round((timeLeft / 7_000) * 20); const points = (15 + speedBonus) * multiplier;
      const nextScore = score + points; const nextRoundScore = roundScore + points; const nextRemaining = remainingTargets - 1; const nextCorrect = correctTaps + 1; const nextMax = Math.max(maxCombo, nextCombo);
      setCells((items) => items.map((item) => item.id === cell.id ? { ...item, removed: true } : item)); setCombo(nextCombo); setMaxCombo(nextMax); setScore(nextScore); setRoundScore(nextRoundScore); setRemainingTargets(nextRemaining); setCorrectTaps(nextCorrect); setFeedback("correct"); impact("success");
      setTimeout(() => setFeedback(null), 180);
      if (nextRemaining <= 0) { canTap.current = false; setRoundWon(true); setTimeout(() => setPhase("round"), 350); }
    } else {
      const nextMistakes = mistakes + 1; const nextWrong = wrongTaps + 1;
      setMistakes(nextMistakes); setWrongTaps(nextWrong); setCombo(0); setFeedback("wrong"); impact("error"); setTimeout(() => setFeedback(null), 220);
      if (nextMistakes >= 3) { canTap.current = false; setTimeout(() => finish({ mistakes: nextMistakes, wrong: nextWrong }), 350); }
    }
  };

  const continueGame = () => {
    if (round >= TOTAL_ROUNDS) finish(); else buildRound(round + 1);
  };

  if (phase === "intro") return <GameRoot colors={["#2B1B16", "#100F18", "#08070C"]} skin={skin}><GameHeader title="VOLT" accent={theme.primary} onExit={onExit} /><IntroScreen eyebrow="SPEED OF THOUGHT" title="VOLT" subtitle="Запомни цель и найди все совпадения. Три ошибки заканчивают игру." accent={theme.primary} onStart={start}><View style={styles.preview}>{ICONS.slice(0, 8).map((icon) => <LinearGradient key={icon.name} colors={icon.colors} style={styles.previewCell}><Ionicons name={icon.icon} color="#FFFFFF" size={22} /></LinearGradient>)}</View><Text style={styles.hardcore}>ХАРДКОР · 5×5 · 12 РАУНДОВ</Text></IntroScreen></GameRoot>;

  const accuracy = Math.round((correctTaps / Math.max(1, correctTaps + wrongTaps)) * 100);
  if (phase === "result") return <GameRoot colors={["#2B1B16", "#100F18", "#08070C"]} skin={skin}><GameHeader title="VOLT" accent={theme.primary} onExit={onExit} /><ResultScreen title={score >= 1500 && accuracy >= 85 ? "ЛЕГЕНДА" : accuracy >= 80 ? "ОТЛИЧНО" : accuracy >= 60 ? "ХОРОШО" : "ТРЕНИРУЙСЯ"} score={score} accent={theme.primary} onRestart={start} onExit={onExit} stats={[{ label: "Верно", value: correctTaps }, { label: "Ошибок", value: wrongTaps }, { label: "Точность", value: `${accuracy}%` }, { label: "Рекорд", value: Math.max(best, score) }]} /></GameRoot>;

  if (phase === "round") return <GameRoot colors={["#2B1B16", "#100F18", "#08070C"]} skin={skin}><GameHeader title="VOLT" accent={theme.primary} onExit={onExit} /><Animated.View entering={ZoomIn.springify()} style={styles.roundScreen}><View style={styles.roundIcon}><Ionicons name={roundWon ? "checkmark-circle" : "timer-outline"} color={theme.primary} size={68} /></View><Text style={styles.roundTitle}>{roundWon ? `РАУНД ${round}` : "ВРЕМЯ"}</Text><Text style={styles.roundSubtitle}>{roundWon ? `${suggestedCoins(score)} coin` : "Продолжаем"}</Text><ArcadeButton accent={theme.primary} onPress={continueGame} style={styles.next}>{round >= TOTAL_ROUNDS ? "ФИНИШ" : "ДАЛЬШЕ"}</ArcadeButton></Animated.View></GameRoot>;

  const target = ICONS[targetIndex]!;
  const maxGrid = Math.min(width - 28, height * 0.52, 520); const gap = width < 380 ? 6 : 9; const cellSize = Math.floor((maxGrid - gap * 4) / 5); const duration = roundDuration(round) * 1000;
  return (
    <GameRoot colors={["#2B1B16", "#100F18", "#08070C"]} skin={skin}>
      <GameHeader title="VOLT" accent={theme.primary} onExit={onExit} />
      <View style={styles.hud}><HudStat label="COIN" value={suggestedCoins(score)} color={theme.primary} /><HudStat label="Раунд" value={`${round}/${TOTAL_ROUNDS}`} /><HudStat label="Время" value={formatClock(elapsedMs)} color={theme.secondary} /><HudStat label="Ошибки" value={`${mistakes}/3`} color="#FF5C6C" /></View>
      <View style={[styles.targetStrip, { borderColor: theme.primary }]}><LinearGradient colors={target.colors} style={[styles.targetIcon, { borderColor: theme.primary }]}><Ionicons name={target.icon} color="#FFFFFF" size={29} /></LinearGradient><View style={styles.targetInfo}><Text style={[styles.targetLabel, { color: theme.primary }]}>НАЙДИ ВСЕ</Text><Text style={[styles.targetName, { color: theme.primary }]}>{target.name}</Text><Text style={styles.targetLeft}>осталось · {remainingTargets}</Text></View><View style={styles.targetTimer}><Text style={[styles.time, { color: theme.primary }, timeLeft < duration * 0.3 && { color: "#FF5C6C" }]}>{(timeLeft / 1000).toFixed(1)}</Text><Text style={styles.combo}>КОМБО ×{Math.min(combo, 6)}</Text></View></View>
      <ProgressBar progress={timeLeft / duration} color={timeLeft < duration * 0.3 ? "#FF5C6C" : theme.primary} />
      <View style={styles.gridStage}><View style={[styles.grid, { width: cellSize * 5 + gap * 4, gap }]}>{cells.map((cell) => {
        const icon = ICONS[cell.iconIndex]!;
        return <Animated.View key={cell.id} entering={FadeInDown.delay(cell.id * 12).duration(180)} exiting={ZoomOut.duration(180)}><Pressable accessibilityRole="button" accessibilityLabel={icon.name} disabled={cell.removed} onPress={() => choose(cell)} style={({ pressed }) => [pressed && styles.cellPressed, cell.removed && styles.cellRemoved]}><LinearGradient colors={icon.colors} style={[styles.cell, { width: cellSize, height: cellSize }]}><View style={styles.cellGloss} /><Ionicons name={icon.icon} color="#FFFFFF" size={cellSize * 0.42} style={styles.cellGlyph} /></LinearGradient></Pressable></Animated.View>;
      })}</View>{feedback ? <Animated.View pointerEvents="none" entering={ZoomIn.springify()} style={styles.feedback}><Ionicons name={feedback === "correct" ? "checkmark-circle" : "close-circle"} color={feedback === "correct" ? theme.primary : "#FF5C6C"} size={74} /></Animated.View> : null}</View>
    </GameRoot>
  );
}

const styles = StyleSheet.create({
  preview: { width: 240, flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  previewCell: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  hardcore: { color: "rgba(255,255,255,0.42)", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  hud: { flexDirection: "row", gap: 5 },
  targetStrip: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 10, padding: 11, borderRadius: 18, backgroundColor: "rgba(245,200,66,0.09)", borderWidth: 1, borderColor: "rgba(245,200,66,0.28)" },
  targetIcon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(245,200,66,0.42)" },
  targetInfo: { flex: 1 },
  targetLabel: { color: "rgba(245,200,66,0.62)", fontSize: 8, fontWeight: "900", letterSpacing: 2 },
  targetName: { color: "#F5C842", fontSize: 18, fontWeight: "900" },
  targetLeft: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "700" },
  targetTimer: { alignItems: "flex-end" },
  time: { color: "#F5C842", fontSize: 28, fontWeight: "900", fontVariant: ["tabular-nums"] },
  combo: { color: "rgba(255,255,255,0.38)", fontSize: 8, fontWeight: "900" },
  gridStage: { flex: 1, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { borderRadius: 999, alignItems: "center", justifyContent: "center", shadowColor: "#000000", shadowOpacity: 0.4, shadowRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  cellGloss: { position: "absolute", top: "8%", left: "14%", width: "50%", height: "36%", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.25)" },
  cellGlyph: { zIndex: 2 },
  cellPressed: { transform: [{ scale: 0.86 }] },
  cellRemoved: { opacity: 0, transform: [{ scale: 0 }] },
  feedback: { position: "absolute", width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(5,5,10,0.54)" },
  roundScreen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  roundIcon: { width: 82, height: 82, alignItems: "center", justifyContent: "center" },
  roundTitle: { color: "#FFFFFF", fontSize: 42, fontWeight: "900" },
  roundSubtitle: { color: "rgba(255,255,255,0.48)", fontSize: 13, fontWeight: "800" },
  next: { width: "100%", maxWidth: 330, marginTop: 12 },
});

export default VoltMatchGame;
