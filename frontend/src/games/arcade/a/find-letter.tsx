import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { GameHeader, GameRoot, HudStat, IntroScreen, LivesStat, ProgressBar, ResultScreen, impact, resolveArcadeSkin } from "./primitives";
import type { ArcadeGameProps } from "./types";
import { formatClock, shuffle, shuffleAvoidingFirst, suggestedCoins } from "./utils";

const GAME_ID = "find-letter" as const;
const LETTERS = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯ".split("");
const LEVELS = [
  { name: "ЛЁГКИЙ", columns: 3, total: 9, seconds: 34 },
  { name: "СРЕДНИЙ", columns: 3, total: 12, seconds: 31 },
  { name: "СЛОЖНЫЙ", columns: 4, total: 16, seconds: 28 },
  { name: "ЭКСПЕРТ", columns: 4, total: 20, seconds: 23 },
  { name: "МАСТЕР", columns: 5, total: 25, seconds: 20 },
] as const;
const TOTAL_ROUNDS = 12;
const CIRCUMFERENCE = 147.65;

function configFor(round: number) { return LEVELS[Math.min(Math.floor(round / 2), LEVELS.length - 1)]!; }

function makeRound(round: number, previousAnswer?: string) {
  const config = configFor(round);
  const answer = shuffleAvoidingFirst(LETTERS, previousAnswer)[0]!;
  const others = shuffle(LETTERS.filter((letter) => letter !== answer)).slice(0, config.total - 2);
  return { answer, letters: shuffle([answer, answer, ...others]) };
}

export function FindLetterGame({ initialBestScore = 0, skin, onExit, onComplete }: ArcadeGameProps) {
  const theme = resolveArcadeSkin(skin, "#38BDF8", "#FBBF24");
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [round, setRound] = useState(0);
  const [puzzle, setPuzzle] = useState(() => makeRound(0));
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(configFor(0).seconds * 1000);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [feedback, setFeedback] = useState<{ selected: string; ok: boolean; timeout?: boolean } | null>(null);
  const [best, setBest] = useState(initialBestScore);
  const startedAt = useRef(0);
  const deadline = useRef(0);
  const finishing = useRef(false);
  const busy = useRef(false);
  const lastAnswer = useRef<string | undefined>(undefined);
  const config = configFor(round);

  const prepareRound = useCallback((nextRound: number) => {
    const nextConfig = configFor(nextRound);
    const nextPuzzle = makeRound(nextRound, lastAnswer.current);
    lastAnswer.current = nextPuzzle.answer;
    setRound(nextRound); setPuzzle(nextPuzzle); setTimeLeft(nextConfig.seconds * 1000); setFeedback(null); busy.current = false;
    deadline.current = Date.now() + nextConfig.seconds * 1000;
  }, []);

  const start = useCallback(() => {
    finishing.current = false; busy.current = false; lastAnswer.current = undefined; startedAt.current = Date.now(); setScore(0); setLives(3); setCorrectCount(0); setStreak(0); setElapsedMs(0); setPhase("playing"); prepareRound(0);
  }, [prepareRound]);

  const finish = useCallback((won: boolean, final?: { score?: number; correct?: number; lives?: number; rounds?: number }) => {
    if (finishing.current) return;
    finishing.current = true; busy.current = true;
    const finalScore = final?.score ?? score; const finalCorrect = final?.correct ?? correctCount; const finalLives = final?.lives ?? lives; const rounds = final?.rounds ?? round;
    const duration = Date.now() - startedAt.current; const accuracy = rounds ? Math.round((finalCorrect / rounds) * 100) : 0;
    setElapsedMs(duration); setScore(finalScore); setCorrectCount(finalCorrect); setLives(finalLives); setRound(rounds); setBest((value) => Math.max(value, finalScore)); setPhase("result");
    onComplete?.({ gameId: GAME_ID, score: finalScore, won, durationMs: duration, suggestedCoins: suggestedCoins(finalScore, won), stats: { correct: finalCorrect, rounds, accuracy, lives: finalLives } });
  }, [correctCount, lives, onComplete, round, score]);

  const advance = useCallback((nextRound: number, nextLives: number, finalScore: number, finalCorrect: number) => {
    if (nextLives <= 0) { finish(false, { score: finalScore, correct: finalCorrect, lives: nextLives, rounds: nextRound }); return; }
    if (nextRound >= TOTAL_ROUNDS) { finish(true, { score: finalScore, correct: finalCorrect, lives: nextLives, rounds: nextRound }); return; }
    prepareRound(nextRound);
  }, [finish, prepareRound]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = setInterval(() => {
      const next = Math.max(0, deadline.current - Date.now());
      setTimeLeft(next); setElapsedMs(Date.now() - startedAt.current);
      if (next <= 0 && !busy.current) {
        busy.current = true;
        const nextLives = lives - 1; const nextRound = round + 1; const nextScore = Math.max(0, score - 50);
        setLives(nextLives); setScore(nextScore); setStreak(0); setFeedback({ selected: "", ok: false, timeout: true }); impact("error");
        setTimeout(() => advance(nextRound, nextLives, nextScore, correctCount), 820);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [advance, correctCount, lives, phase, round, score]);

  const choose = (letter: string) => {
    if (busy.current || phase !== "playing") return;
    busy.current = true;
    const ok = letter === puzzle.answer;
    const nextRound = round + 1;
    let nextScore = score; let nextCorrect = correctCount; let nextLives = lives;
    if (ok) {
      const nextStreak = streak + 1; const bonus = Math.floor(timeLeft / 1000) * 2; const streakBonus = nextStreak >= 3 ? 50 : 0;
      nextScore += 100 + bonus + streakBonus; nextCorrect += 1; setStreak(nextStreak); setCorrectCount(nextCorrect); impact("success");
    } else {
      nextScore = Math.max(0, nextScore - 30); nextLives -= 1; setStreak(0); setLives(nextLives); impact("error");
    }
    setScore(nextScore); setFeedback({ selected: letter, ok });
    setTimeout(() => advance(nextRound, nextLives, nextScore, nextCorrect), 820);
  };

  if (phase === "intro") return <GameRoot colors={["#123B5F", "#0C1A2E", "#071830"]} skin={skin}><GameHeader title="НАЙДИ БУКВУ" accent={theme.primary} onExit={onExit} /><IntroScreen eyebrow="ВНИМАНИЕ" title="НАЙДИ БУКВУ" subtitle="В сетке только одна буква встречается дважды. Найди её раньше, чем закончится время." accent={theme.primary} onStart={start}><Text style={[styles.letterMark, { color: theme.secondary }]}>А А</Text></IntroScreen></GameRoot>;

  const playedRounds = phase === "result" ? Math.min(round, TOTAL_ROUNDS) : round;
  const accuracy = playedRounds ? Math.round((correctCount / playedRounds) * 100) : 0;
  if (phase === "result") return <GameRoot colors={["#123B5F", "#0C1A2E", "#071830"]} skin={skin}><GameHeader title="НАЙДИ БУКВУ" accent={theme.primary} onExit={onExit} /><ResultScreen title={lives > 0 && round >= TOTAL_ROUNDS ? "ПОБЕДА" : "ИГРА ОКОНЧЕНА"} score={score} accent={theme.secondary} onRestart={start} onExit={onExit} stats={[{ label: "Верно", value: correctCount }, { label: "Точность", value: `${accuracy}%` }, { label: "Время", value: formatClock(elapsedMs) }, { label: "Рекорд", value: Math.max(best, score) }]} /></GameRoot>;

  const maxGrid = Math.min(width - 106, height * 0.53, 470);
  const gap = config.columns >= 5 ? 5 : 7;
  const cellSize = Math.floor((maxGrid - gap * (config.columns - 1)) / config.columns);
  const remainingRatio = timeLeft / (config.seconds * 1000);
  return (
    <GameRoot colors={["#123B5F", "#0C1A2E", "#071830"]} skin={skin}>
      <GameHeader title="НАЙДИ БУКВУ" accent={theme.primary} onExit={onExit} right={<View style={styles.scoreBadge}><Ionicons name="diamond" color={theme.secondary} size={14} /><Text style={[styles.score, { color: theme.secondary }]}>{suggestedCoins(score)}</Text></View>} />
      <View style={styles.hud}><HudStat label="Раунд" value={`${round + 1}/${TOTAL_ROUNDS}`} /><HudStat label="Верно" value={correctCount} color={theme.primary} /><LivesStat lives={lives} color="#FB7185" /><HudStat label="Время" value={formatClock(elapsedMs)} /></View>
      <ProgressBar progress={round / TOTAL_ROUNDS} color={theme.secondary} />
      <View style={[styles.question, { borderColor: theme.primary }]}><Text style={styles.questionText}>Какая буква написана <Text style={[styles.highlight, { color: theme.secondary }]}>2 раза</Text>?</Text><Text style={[styles.difficulty, { color: theme.primary }]}>{config.name}</Text></View>
      <View style={styles.playRow}>
        <View style={styles.timerWrap}><Svg width={58} height={58}><Circle cx={29} cy={29} r={23.5} fill="none" stroke="rgba(125,211,252,0.15)" strokeWidth={4.5} /><Circle cx={29} cy={29} r={23.5} fill="none" stroke={timeLeft <= 4_000 ? "#EF4444" : theme.primary} strokeWidth={4.5} strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - remainingRatio)} transform="rotate(-90 29 29)" /></Svg><Text style={[styles.timerText, timeLeft <= 4_000 && { color: "#EF4444" }]}>{Math.ceil(timeLeft / 1000)}</Text></View>
        <View style={[styles.grid, { width: cellSize * config.columns + gap * (config.columns - 1), gap }]}>{puzzle.letters.map((letter, index) => {
          const reveal = feedback && letter === puzzle.answer; const selectedWrong = feedback && !feedback.ok && feedback.selected === letter;
          return <Pressable key={`${letter}-${index}`} disabled={!!feedback} onPress={() => choose(letter)} style={({ pressed }) => [styles.cell, { width: cellSize, height: cellSize }, reveal && styles.correctCell, selectedWrong && styles.wrongCell, pressed && styles.pressed]}><Text style={[styles.cellText, { fontSize: Math.max(14, cellSize * 0.34) }, reveal && { color: "#86EFAC" }, selectedWrong && { color: "#FCA5A5" }]}>{letter}</Text></Pressable>;
        })}</View>
      </View>
      <View style={styles.feedbackSpace}>{feedback ? <Animated.Text entering={FadeInDown.springify()} style={[styles.feedback, { color: feedback.ok ? "#86EFAC" : "#FCA5A5" }]}>{feedback.ok ? "ВЕРНО" : feedback.timeout ? `ВРЕМЯ · ${puzzle.answer}` : `ОТВЕТ · ${puzzle.answer}`}</Animated.Text> : null}</View>
    </GameRoot>
  );
}

const styles = StyleSheet.create({
  letterMark: { color: "#FBBF24", fontSize: 56, fontWeight: "900", letterSpacing: 12 },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  score: { color: "#FBBF24", fontSize: 14, fontWeight: "900" },
  hud: { flexDirection: "row", gap: 6 },
  question: { marginVertical: 12, alignItems: "center", padding: 14, borderRadius: 18, backgroundColor: "rgba(14,165,233,0.12)", borderWidth: 1, borderColor: "rgba(125,211,252,0.26)" },
  questionText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", textAlign: "center" },
  highlight: { color: "#FBBF24" },
  difficulty: { marginTop: 5, color: "#7DD3FC", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  playRow: { flex: 1, flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 10 },
  timerWrap: { width: 58, height: 58, alignItems: "center", justifyContent: "center" },
  timerText: { position: "absolute", color: "#FFFFFF", fontSize: 15, fontWeight: "900", fontVariant: ["tabular-nums"] },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: 10, borderRadius: 22, backgroundColor: "rgba(7,24,48,0.72)", borderWidth: 1, borderColor: "rgba(125,211,252,0.22)" },
  cell: { alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(125,211,252,0.15)" },
  pressed: { transform: [{ scale: 0.9 }], backgroundColor: "rgba(255,255,255,0.1)" },
  correctCell: { backgroundColor: "rgba(34,197,94,0.23)", borderColor: "#22C55E" },
  wrongCell: { backgroundColor: "rgba(239,68,68,0.22)", borderColor: "#EF4444" },
  cellText: { color: "#E0F2FE", fontWeight: "900", textShadowColor: "rgba(125,211,252,0.35)", textShadowRadius: 8 },
  feedbackSpace: { minHeight: 54, alignItems: "center", justifyContent: "center" },
  feedback: { fontSize: 12, fontWeight: "900", letterSpacing: 2.2 },
});

export default FindLetterGame;
