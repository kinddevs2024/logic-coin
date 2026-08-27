import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";

import { GameHeader, GameRoot, HudStat, IntroScreen, ProgressBar, ResultScreen, impact, resolveArcadeSkin } from "./primitives";
import type { ArcadeGameProps } from "./types";
import { randomInt, shuffle, suggestedCoins } from "./utils";
import { usePauseClock } from "@/games/pause-clock";

const GAME_ID = "brain-training" as const;
const SESSION_MS = 80_000;
const ROUND_MS = 8_000;
const PALETTES = [
  ["#A78BFA", "#5B21B6"], ["#F472B6", "#9D174D"], ["#60A5FA", "#1D4ED8"], ["#34D399", "#047857"],
  ["#FBBF24", "#B45309"], ["#FB7185", "#BE123C"], ["#22D3EE", "#0E7490"], ["#C084FC", "#7E22CE"],
] as const;

type Expression = { label: string; result: number };
type Bubble = Expression & { id: number; x: number; y: number; vx: number; vy: number; size: number; palette: number };

function generateExpression(): Expression {
  const op = shuffle(["+", "+", "+", "+", "-", "-", "×"])[0]!;
  if (op === "+") {
    const a = randomInt(1, 19); const b = randomInt(1, Math.max(1, 28 - a));
    return { label: `${a}+${b}`, result: a + b };
  }
  if (op === "-") {
    const a = randomInt(2, 28); const b = randomInt(1, a);
    return { label: `${a}−${b}`, result: a - b };
  }
  const a = randomInt(2, 5); const b = randomInt(2, 5);
  return { label: `${a}×${b}`, result: a * b };
}

function makeExpressions(count: number, previousTarget?: number) {
  let correct = generateExpression();
  for (let attempt = 0; attempt < 12 && correct.result === previousTarget; attempt += 1) correct = generateExpression();
  const expressions = [correct];
  const used = new Set([correct.result]);
  while (expressions.length < count) {
    const next = generateExpression();
    if (!used.has(next.result)) { used.add(next.result); expressions.push(next); }
  }
  return { target: correct.result, expressions: shuffle(expressions) };
}

export function BrainTrainingGame({ initialBestScore = 0, extraTimeSeconds = 0, paused = false, skin, onExit, onComplete }: ArcadeGameProps) {
  const theme = resolveArcadeSkin(skin, "#C8A96E", "#7EB8F7");
  const sessionDuration = SESSION_MS + Math.max(0, extraTimeSeconds) * 1000;
  const { width, height } = useWindowDimensions();
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [score, setScore] = useState(0);
  const [target, setTarget] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [remainingMs, setRemainingMs] = useState(sessionDuration);
  const [roundRemaining, setRoundRemaining] = useState(ROUND_MS);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [best, setBest] = useState(initialBestScore);
  const arenaWidth = Math.min(width - 32, 620);
  const arenaHeight = Math.max(290, Math.min(height * 0.54, 520));
  const gameStartedAt = useRef(0);
  const roundDeadline = useRef(0);
  const uid = useRef(0);
  const finishing = useRef(false);
  usePauseClock(paused, [gameStartedAt, roundDeadline]);
  const lastTarget = useRef<number | undefined>(undefined);

  const spawnRound = useCallback((elapsed: number) => {
    const count = elapsed >= 63_000 ? 7 : elapsed >= 50_000 ? 6 : 5;
    const generated = makeExpressions(count, lastTarget.current);
    lastTarget.current = generated.target;
    const size = Math.max(68, Math.min(88, arenaWidth / 4.2));
    const columns = arenaWidth > 470 ? 4 : 3;
    const rows = Math.ceil(count / columns);
    const xStep = arenaWidth / columns;
    const yStep = arenaHeight / rows;
    const next = generated.expressions.map((expression, index): Bubble => {
      const column = index % columns; const row = Math.floor(index / columns);
      const speed = 0.24 + Math.random() * 0.34;
      const angle = Math.random() * Math.PI * 2;
      return { ...expression, id: uid.current++, size, x: column * xStep + xStep / 2, y: row * yStep + yStep / 2, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, palette: randomInt(0, PALETTES.length - 1) };
    });
    setTarget(generated.target); setBubbles(next); setFlash(null); setRoundRemaining(ROUND_MS); roundDeadline.current = Date.now() + ROUND_MS;
  }, [arenaHeight, arenaWidth]);

  const start = useCallback(() => {
    finishing.current = false; lastTarget.current = undefined; gameStartedAt.current = Date.now(); setScore(0); setCombo(0); setMaxCombo(0); setCorrect(0); setWrong(0); setRemainingMs(sessionDuration); setPhase("playing");
    setTimeout(() => spawnRound(0), 0);
  }, [sessionDuration, spawnRound]);

  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    const won = correct > wrong;
    setBest((value) => Math.max(value, score)); setPhase("result");
    onComplete?.({ gameId: GAME_ID, score, won, durationMs: Date.now() - gameStartedAt.current, suggestedCoins: suggestedCoins(score, won), stats: { correct, wrong, maxCombo } });
  }, [correct, maxCombo, onComplete, score, wrong]);

  useEffect(() => {
    if (phase !== "playing" || paused) return;
    const movement = setInterval(() => {
      setBubbles((items) => items.map((bubble) => {
        let x = bubble.x + bubble.vx; let y = bubble.y + bubble.vy; let vx = bubble.vx; let vy = bubble.vy;
        const radius = bubble.size / 2;
        if (x < radius) { x = radius; vx = Math.abs(vx); }
        if (x > arenaWidth - radius) { x = arenaWidth - radius; vx = -Math.abs(vx); }
        if (y < radius) { y = radius; vy = Math.abs(vy); }
        if (y > arenaHeight - radius) { y = arenaHeight - radius; vy = -Math.abs(vy); }
        return { ...bubble, x, y, vx, vy };
      }));
    }, 16);
    return () => clearInterval(movement);
  }, [arenaHeight, arenaWidth, paused, phase]);

  useEffect(() => {
    if (phase !== "playing" || paused) return;
    const timer = setInterval(() => {
      const elapsed = Date.now() - gameStartedAt.current;
      const sessionLeft = Math.max(0, sessionDuration - elapsed);
      const promptLeft = Math.max(0, roundDeadline.current - Date.now());
      setRemainingMs(sessionLeft); setRoundRemaining(promptLeft);
      if (sessionLeft <= 0) { finish(); return; }
      if (promptLeft <= 0 && !flash) {
        setScore((value) => Math.max(0, value - 3)); setCombo(0); setFlash("wrong"); impact("error");
        setTimeout(() => spawnRound(elapsed), 180);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [finish, flash, paused, phase, sessionDuration, spawnRound]);

  const choose = (bubble: Bubble) => {
    if (flash) return;
    if (bubble.result === target) {
      const nextCombo = combo + 1;
      const earned = 10 + Math.max(0, nextCombo - 1) * 5;
      setScore((value) => value + earned); setCorrect((value) => value + 1); setCombo(nextCombo); setMaxCombo((value) => Math.max(value, nextCombo)); setFlash("correct"); impact("success");
      setBubbles((items) => items.filter((item) => item.id !== bubble.id));
      setTimeout(() => spawnRound(Date.now() - gameStartedAt.current), 260);
    } else {
      setScore((value) => Math.max(0, value - 5)); setWrong((value) => value + 1); setCombo(0); setFlash("wrong"); impact("error");
      setTimeout(() => setFlash(null), 260);
    }
  };

  if (phase === "intro") return <GameRoot colors={["#17132E", "#080E1F", "#071323"]} skin={skin}><GameHeader title="МОЗГОВОЙ ШТУРМ" accent={theme.primary} onExit={onExit} /><IntroScreen eyebrow="ТРЕНИРОВКА ИНТЕЛЛЕКТА" title="МОЗГОВОЙ ШТУРМ" subtitle="Найди выражение, которое равно числу в центре. Пузыри двигаются, время не ждёт." accent={theme.primary} onStart={start}><View style={[styles.brainMark, { borderColor: theme.primary, shadowColor: theme.primary }]}><Ionicons name="bulb-outline" color={theme.primary} size={58} /></View></IntroScreen></GameRoot>;

  if (phase === "result") return <GameRoot colors={["#17132E", "#080E1F", "#071323"]} skin={skin}><GameHeader title="МОЗГОВОЙ ШТУРМ" accent={theme.primary} onExit={onExit} /><ResultScreen title={correct > wrong ? "СИЛЬНЫЙ РАЗУМ" : "ЕЩЁ ОДИН РАУНД"} score={score} accent={theme.primary} onRestart={start} onExit={onExit} stats={[{ label: "Верных", value: correct }, { label: "Ошибок", value: wrong }, { label: "Комбо", value: maxCombo }, { label: "Рекорд", value: Math.max(best, score) }]} /></GameRoot>;

  return (
    <GameRoot colors={["#17132E", "#080E1F", "#071323"]} skin={skin}>
      <GameHeader title="МОЗГОВОЙ ШТУРМ" accent={theme.primary} onExit={onExit} />
      <View style={styles.hud}><HudStat label="COIN" value={suggestedCoins(score)} color={theme.primary} /><View style={[styles.targetBox, { borderColor: theme.primary }]}><Text style={styles.targetLabel}>НАЙТИ</Text><Text style={styles.target}>{target}</Text><ProgressBar progress={roundRemaining / ROUND_MS} color={theme.primary} height={3} /></View><HudStat label="Время" value={Math.ceil(remainingMs / 1000)} color={remainingMs <= 10_000 ? "#E05C6A" : "#6EDBA8"} /></View>
      <ProgressBar progress={remainingMs / sessionDuration} color={remainingMs <= 10_000 ? "#E05C6A" : theme.secondary} />
      <View style={[styles.arena, { width: arenaWidth, height: arenaHeight }]}>
        {bubbles.map((bubble) => {
          const palette = PALETTES[bubble.palette]!;
          return <Animated.View key={bubble.id} entering={ZoomIn.springify().damping(14)} exiting={ZoomOut.duration(180)} style={[styles.bubblePosition, { width: bubble.size, height: bubble.size, left: bubble.x - bubble.size / 2, top: bubble.y - bubble.size / 2 }]}><Pressable accessibilityRole="button" accessibilityLabel={`Выражение ${bubble.label}`} onPress={() => choose(bubble)} style={styles.bubblePress}><LinearGradient colors={[palette[0], palette[1]]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.bubble}><View style={styles.gloss} /><Text style={styles.expression}>{bubble.label}</Text></LinearGradient></Pressable></Animated.View>;
        })}
        {flash ? <Animated.View entering={FadeIn.duration(100)} exiting={FadeOut.duration(100)} pointerEvents="none" style={[styles.flash, { backgroundColor: flash === "correct" ? "rgba(110,219,168,0.12)" : "rgba(224,92,106,0.12)" }]}><Text style={[styles.flashText, { color: flash === "correct" ? "#6EDBA8" : "#E05C6A" }]}>{flash === "correct" ? `×${combo || 1}` : "МИМО"}</Text></Animated.View> : null}
      </View>
    </GameRoot>
  );
}

const styles = StyleSheet.create({
  brainMark: { width: 86, height: 86, borderRadius: 43, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(200,169,110,0.10)", borderWidth: 1, borderColor: "rgba(200,169,110,0.28)", shadowColor: "#C8A96E", shadowOpacity: 0.28, shadowRadius: 24 },
  hud: { flexDirection: "row", gap: 8, marginBottom: 10 },
  targetBox: { flex: 1.55, minWidth: 100, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15, backgroundColor: "rgba(200,169,110,0.08)", borderWidth: 1, borderColor: "rgba(200,169,110,0.28)" },
  targetLabel: { color: "rgba(255,255,255,0.38)", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  target: { color: "#FFFFFF", fontSize: 34, lineHeight: 38, fontWeight: "900" },
  arena: { alignSelf: "center", marginTop: 12, borderRadius: 28, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.025)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", position: "relative" },
  bubblePosition: { position: "absolute" },
  bubblePress: { flex: 1 },
  bubble: { flex: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.24)", shadowColor: "#000000", shadowOpacity: 0.3, shadowRadius: 12 },
  gloss: { position: "absolute", top: "13%", left: "20%", width: "44%", height: "25%", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.26)", transform: [{ rotate: "-18deg" }] },
  expression: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.3)", textShadowRadius: 4 },
  flash: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" },
  flashText: { fontSize: 44, fontWeight: "900", letterSpacing: 2 },
});

export default BrainTrainingGame;
