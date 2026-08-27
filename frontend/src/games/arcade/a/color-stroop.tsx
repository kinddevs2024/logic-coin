import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";

import { GameHeader, GameRoot, HudStat, IntroScreen, ProgressBar, ResultScreen, impact, resolveArcadeSkin } from "./primitives";
import type { ArcadeGameProps } from "./types";
import { nowMs, randomIntExcluding, shuffle, suggestedCoins } from "./utils";
import { usePauseClock } from "@/games/pause-clock";

const GAME_ID = "color-stroop" as const;
const DURATION_MS = 60_000;
const ROUND_MS = 2_400;
const COLORS = [
  { name: "КРАСНЫЙ", value: "#EF4444" },
  { name: "СИНИЙ", value: "#3B82F6" },
  { name: "ЗЕЛЁНЫЙ", value: "#22C55E" },
  { name: "ЖЁЛТЫЙ", value: "#EAB308" },
  { name: "ФИОЛЕТ", value: "#A855F7" },
  { name: "РОЗОВЫЙ", value: "#EC4899" },
] as const;

type Puzzle = { word: number; ink: number; options: number[]; createdAt: number };

function createPuzzle(previousInk?: number): Puzzle {
  const ink = randomIntExcluding(0, COLORS.length - 1, previousInk);
  let word = ink;
  if (Math.random() < 0.7) word = randomIntExcluding(0, COLORS.length - 1, ink);
  const distractor = shuffle(COLORS.map((_, index) => index).filter((index) => index !== ink))[0]!;
  return { word, ink, options: shuffle([ink, distractor]), createdAt: Date.now() };
}

export function ColorStroopGame({ initialBestScore = 0, extraTimeSeconds = 0, paused = false, skin, onExit, onComplete }: ArcadeGameProps) {
  const theme = resolveArcadeSkin(skin, "#EAB308", "#FDE68A");
  const sessionDuration = DURATION_MS + Math.max(0, extraTimeSeconds) * 1000;
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [puzzle, setPuzzle] = useState(createPuzzle);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [remainingMs, setRemainingMs] = useState(sessionDuration);
  const [roundRemaining, setRoundRemaining] = useState(ROUND_MS);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [best, setBest] = useState(initialBestScore);
  const gameStartedAt = useRef(0);
  const roundDeadline = useRef(0);
  const finishing = useRef(false);
  usePauseClock(paused, [gameStartedAt, roundDeadline]);

  const finish = useCallback((snapshot?: Partial<{ score: number; correct: number; total: number; maxStreak: number; reactionTimes: number[]; lives: number }>) => {
    if (finishing.current) return;
    finishing.current = true;
    const finalScore = snapshot?.score ?? score;
    const finalCorrect = snapshot?.correct ?? correct;
    const finalTotal = snapshot?.total ?? total;
    const finalStreak = snapshot?.maxStreak ?? maxStreak;
    const times = snapshot?.reactionTimes ?? reactionTimes;
    const finalLives = snapshot?.lives ?? lives;
    const accuracy = finalTotal ? Math.round((finalCorrect / finalTotal) * 100) : 0;
    const averageReaction = times.length ? Math.round(times.reduce((sum, item) => sum + item, 0) / times.length) : 0;
    setBest((value) => Math.max(value, finalScore));
    setPhase("result");
    onComplete?.({ gameId: GAME_ID, score: finalScore, won: accuracy >= 50 && finalCorrect > 0, durationMs: Date.now() - gameStartedAt.current, suggestedCoins: suggestedCoins(finalScore, accuracy >= 50), stats: { correct: finalCorrect, total: finalTotal, accuracy, averageReactionMs: averageReaction, maxStreak: finalStreak, lives: finalLives } });
  }, [correct, lives, maxStreak, onComplete, reactionTimes, score, total]);

  const nextPuzzle = useCallback(() => {
    roundDeadline.current = Date.now() + ROUND_MS;
    setRoundRemaining(ROUND_MS);
    setPuzzle((current) => createPuzzle(current.ink));
    setFlash(null);
  }, []);

  const start = useCallback(() => {
    finishing.current = false;
    gameStartedAt.current = Date.now();
    setScore(0); setCorrect(0); setTotal(0); setLives(3); setStreak(0); setMaxStreak(0); setReactionTimes([]);
    setRemainingMs(sessionDuration);
    setPhase("playing");
    nextPuzzle();
  }, [nextPuzzle, sessionDuration]);

  useEffect(() => {
    if (phase !== "playing" || paused) return;
    const tick = setInterval(() => {
      const sessionLeft = Math.max(0, sessionDuration - (Date.now() - gameStartedAt.current));
      const promptLeft = Math.max(0, roundDeadline.current - Date.now());
      setRemainingMs(sessionLeft);
      setRoundRemaining(promptLeft);
      if (sessionLeft <= 0) { finish(); return; }
      if (promptLeft <= 0 && !flash) {
        const nextLives = lives - 1;
        const nextTotal = total + 1;
        setLives(nextLives); setTotal(nextTotal); setStreak(0); setFlash("wrong");
        impact("error");
        if (nextLives <= 0) setTimeout(() => finish({ lives: nextLives, total: nextTotal }), 320);
        else setTimeout(nextPuzzle, 260);
      }
    }, 50);
    return () => clearInterval(tick);
  }, [finish, flash, lives, nextPuzzle, paused, phase, sessionDuration, total]);

  const choose = (index: number) => {
    if (phase !== "playing" || flash) return;
    const reaction = nowMs() - puzzle.createdAt;
    const nextTotal = total + 1;
    setTotal(nextTotal);
    setReactionTimes((items) => [...items, reaction]);
    if (index === puzzle.ink) {
      const nextCorrect = correct + 1;
      const nextStreak = Math.min(streak + 1, 6);
      const multiplier = [1, 1, 1.5, 2, 3, 4, 5][nextStreak] ?? 5;
      const earned = Math.round(100 * multiplier + Math.max(0, (500 - reaction) / 5));
      setCorrect(nextCorrect); setStreak(nextStreak); setMaxStreak((value) => Math.max(value, nextStreak)); setScore((value) => value + earned); setFlash("correct");
      impact("success");
      setTimeout(nextPuzzle, 220);
    } else {
      const nextLives = lives - 1;
      setLives(nextLives); setStreak(0); setFlash("wrong"); impact("error");
      if (nextLives <= 0) setTimeout(() => finish({ lives: nextLives, total: nextTotal, reactionTimes: [...reactionTimes, reaction] }), 320);
      else setTimeout(nextPuzzle, 260);
    }
  };

  if (phase === "intro") return <GameRoot colors={["#17141E", "#09090B", "#09090B"]} skin={skin}><GameHeader title="ЦВЕТ" accent={theme.primary} onExit={onExit} /><IntroScreen eyebrow="STROOP CHALLENGE" title="ЦВЕТ" subtitle="Смотри только на цвет текста. Само слово будет пытаться тебя запутать." accent={theme.primary} onStart={start}><View style={styles.demo}><Text style={[styles.demoWord, { color: "#3B82F6" }]}>КРАСНЫЙ</Text><Text style={styles.demoCaption}>Какого цвета текст?</Text></View><View style={styles.rules}><Text style={styles.rule}>60 секунд</Text><Text style={styles.rule}>3 жизни</Text><Text style={styles.rule}>Комбо ×5</Text></View></IntroScreen></GameRoot>;

  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const avgReaction = reactionTimes.length ? Math.round(reactionTimes.reduce((sum, item) => sum + item, 0) / reactionTimes.length) : 0;
  if (phase === "result") {
    const title = accuracy >= 95 && correct >= 25 ? "ГЕНИЙ" : accuracy >= 85 ? "ОТЛИЧНО" : accuracy >= 70 ? "ХОРОШО" : "ТРЕНИРУЙСЯ";
    return <GameRoot colors={["#17141E", "#09090B", "#09090B"]} skin={skin}><GameHeader title="ЦВЕТ" accent={theme.primary} onExit={onExit} /><ResultScreen title={title} score={score} accent={theme.primary} onRestart={start} onExit={onExit} stats={[{ label: "Верных", value: correct }, { label: "Точность", value: `${accuracy}%` }, { label: "Реакция", value: `${avgReaction}мс` }, { label: "Рекорд", value: Math.max(best, score) }]} /></GameRoot>;
  }

  const multiplier = [1, 1, 1.5, 2, 3, 4, 5][streak] ?? 5;
  return (
    <GameRoot colors={["#17141E", "#09090B", "#09090B"]} skin={skin}>
      <GameHeader title="ЦВЕТ" accent={theme.primary} onExit={onExit} right={<Text style={styles.timer}>{Math.ceil(remainingMs / 1000)}</Text>} />
      <View style={styles.hud}><HudStat label="COIN" value={suggestedCoins(score)} color={theme.primary} /><HudStat label="Комбо" value={`×${multiplier}`} /><HudStat label="Верных" value={correct} /></View>
      <View style={styles.lifeRow}>{[0, 1, 2].map((index) => <View key={index} style={[styles.life, index >= lives && styles.lifeLost]} />)}</View>
      <ProgressBar progress={remainingMs / sessionDuration} color={remainingMs < 10_000 ? "#EF4444" : theme.primary} />
      <View style={styles.stage}>
        <Animated.View key={`${puzzle.createdAt}-${flash}`} entering={FadeIn.duration(130)} exiting={FadeOut.duration(100)} style={[styles.wordCard, flash === "correct" && styles.correctCard, flash === "wrong" && styles.wrongCard]}>
          <Text style={[styles.word, { color: COLORS[puzzle.ink].value }]}>{COLORS[puzzle.word].name}</Text>
          <Text style={styles.instruction}>НАЖМИ ЦВЕТ ТЕКСТА</Text>
          <ProgressBar progress={roundRemaining / ROUND_MS} color={roundRemaining < 650 ? "#EF4444" : COLORS[puzzle.ink].value} height={4} />
        </Animated.View>
        {flash ? <Animated.Text entering={ZoomIn.springify()} style={[styles.flash, { color: flash === "correct" ? "#22C55E" : "#EF4444" }]}>{flash === "correct" ? "ВЕРНО" : "МИМО"}</Animated.Text> : null}
      </View>
      <View style={styles.answers}>{puzzle.options.map((colorIndex) => <Pressable key={colorIndex} onPress={() => choose(colorIndex)} style={({ pressed }) => [styles.answer, pressed && styles.answerPressed]}><View style={[styles.answerDot, { backgroundColor: COLORS[colorIndex].value }]} /><Text style={styles.answerText}>{COLORS[colorIndex].name}</Text></Pressable>)}</View>
    </GameRoot>
  );
}

const styles = StyleSheet.create({
  demo: { alignItems: "center", gap: 3 },
  demoWord: { fontSize: 38, fontWeight: "900", letterSpacing: 2 },
  demoCaption: { color: "rgba(255,255,255,0.4)", fontSize: 11 },
  rules: { flexDirection: "row", gap: 8 },
  rule: { color: "rgba(255,255,255,0.62)", fontSize: 10, fontWeight: "800", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.07)" },
  timer: { color: "#EAB308", fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] },
  hud: { flexDirection: "row", gap: 8 },
  lifeRow: { flexDirection: "row", gap: 7, justifyContent: "center", marginVertical: 10 },
  life: { width: 22, height: 7, borderRadius: 4, backgroundColor: "#EF4444" },
  lifeLost: { backgroundColor: "rgba(255,255,255,0.1)" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  wordCard: { width: "100%", maxWidth: 520, minHeight: 210, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", padding: 28, alignItems: "center", justifyContent: "center", gap: 22 },
  correctCard: { borderColor: "rgba(34,197,94,0.65)", backgroundColor: "rgba(34,197,94,0.08)" },
  wrongCard: { borderColor: "rgba(239,68,68,0.65)", backgroundColor: "rgba(239,68,68,0.08)" },
  word: { fontSize: 56, lineHeight: 62, fontWeight: "900", letterSpacing: 1, textAlign: "center" },
  instruction: { color: "rgba(255,255,255,0.34)", fontSize: 9, fontWeight: "900", letterSpacing: 2.4 },
  flash: { position: "absolute", bottom: 28, fontSize: 12, fontWeight: "900", letterSpacing: 3 },
  answers: { flexDirection: "row", gap: 12, paddingBottom: 18 },
  answer: { flex: 1, minHeight: 76, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", gap: 8 },
  answerPressed: { transform: [{ scale: 0.96 }], backgroundColor: "rgba(255,255,255,0.12)" },
  answerDot: { width: 14, height: 14, borderRadius: 7 },
  answerText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", letterSpacing: 1.2 },
});

export default ColorStroopGame;
