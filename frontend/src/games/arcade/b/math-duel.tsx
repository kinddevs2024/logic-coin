import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ArcadeIcon } from "./icons";
import type { ArcadeGameProps } from "./types";
import { arcadeSkinAccent, B_COLORS, CoinPill, errorTap, GameScreen, Metric, ProgressTrack, ResultCard, StartCard, successTap } from "./ui";
import { randomInt, rewardCoins } from "./utils";

type Statement = { expression: string; shownAnswer: number; correct: boolean };
type Field = { lives: number; correct: number; wrong: number; question: Statement };
type DuelState = { score: number; combo: number; maxCombo: number; top: Field; bottom: Field };

const GAME_TIME = 75;
const MAX_LIVES = 3;

function generateStatementOnce(hard: boolean): Statement {
  const operators = hard ? ["+", "−", "×", "÷", "×", "÷"] : ["+", "+", "+", "−", "−", "×"];
  const operator = operators[randomInt(0, operators.length - 1)];
  let left = 0;
  let right = 0;
  let answer = 0;
  if (operator === "+") {
    left = randomInt(1, hard ? 40 : 27);
    right = randomInt(1, hard ? 40 : 27);
    answer = left + right;
  } else if (operator === "−") {
    left = randomInt(5, hard ? 55 : 36);
    right = randomInt(1, left);
    answer = left - right;
  } else if (operator === "×") {
    left = randomInt(2, hard ? 9 : 6);
    right = randomInt(2, hard ? 9 : 6);
    answer = left * right;
  } else {
    right = randomInt(2, hard ? 9 : 6);
    answer = randomInt(2, hard ? 9 : 6);
    left = right * answer;
  }
  const correct = Math.random() < 0.5;
  let shownAnswer = answer;
  if (!correct) {
    do {
      shownAnswer = answer + randomInt(hard ? 1 : 2, hard ? 5 : 8) * (Math.random() < 0.5 ? -1 : 1);
    } while (shownAnswer === answer || shownAnswer < 0);
  }
  return { expression: `${left} ${operator} ${right}`, shownAnswer, correct };
}

function generateStatement(hard: boolean, previousExpression?: string): Statement {
  let statement = generateStatementOnce(hard);
  for (let attempt = 0; attempt < 12 && statement.expression === previousExpression; attempt += 1) {
    statement = generateStatementOnce(hard);
  }
  return statement;
}

function makeInitialState(): DuelState {
  const topQuestion = generateStatement(false);
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    top: { lives: MAX_LIVES, correct: 0, wrong: 0, question: topQuestion },
    bottom: { lives: MAX_LIVES, correct: 0, wrong: 0, question: generateStatement(false, topQuestion.expression) },
  };
}

export function MathDuelGame({ onExit, onFinish, initialCoins = 0, extraTimeSeconds = 0, skin }: ArcadeGameProps) {
  const sessionTime = GAME_TIME + Math.max(0, extraTimeSeconds);
  const accent = arcadeSkinAccent(skin, B_COLORS.violet);
  const secondaryAccent = skin && skin.id !== "classic" ? skin.secondary : "#FF8B3D";
  const [screen, setScreen] = useState<"menu" | "play" | "result">("menu");
  const [game, setGame] = useState<DuelState>(() => makeInitialState());
  const [timeLeft, setTimeLeft] = useState(sessionTime);
  const startedAt = useRef(0);
  const gameRef = useRef(game);
  const reported = useRef(false);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const finish = useCallback((finalState: DuelState) => {
    if (reported.current) return;
    reported.current = true;
    const correct = finalState.top.correct + finalState.bottom.correct;
    const wrong = finalState.top.wrong + finalState.bottom.wrong;
    const won = correct > wrong;
    setGame(finalState);
    setScreen("result");
    onFinish?.({
      gameId: "math-duel",
      score: finalState.score,
      coins: rewardCoins(finalState.score, won),
      won,
      durationMs: Date.now() - startedAt.current,
      details: { correct, wrong, combo: finalState.maxCombo },
    });
  }, [onFinish]);

  useEffect(() => {
    if (screen !== "play") return;
    const interval = setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          clearInterval(interval);
          setTimeout(() => finish(gameRef.current), 0);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [finish, screen]);

  const begin = useCallback(() => {
    const state = makeInitialState();
    setGame(state);
    gameRef.current = state;
    setTimeLeft(sessionTime);
    startedAt.current = Date.now();
    reported.current = false;
    setScreen("play");
  }, [sessionTime]);

  const answer = useCallback((side: "top" | "bottom", saysCorrect: boolean) => {
    if (screen !== "play" || game[side].lives <= 0) return;
    const field = game[side];
    const isRight = saysCorrect === field.question.correct;
    const hard = timeLeft <= 20;
    const next: DuelState = {
      ...game,
      top: { ...game.top },
      bottom: { ...game.bottom },
    };
    if (isRight) {
      next.combo += 1;
      next.maxCombo = Math.max(next.maxCombo, next.combo);
      next.score += 10 + Math.max(0, next.combo - 1) * 5;
      next[side].correct += 1;
      successTap();
    } else {
      next.combo = 0;
      next[side].lives -= 1;
      next[side].wrong += 1;
      errorTap();
    }
    next[side].question = generateStatement(hard, field.question.expression);
    setGame(next);
    gameRef.current = next;
    if (next.top.lives <= 0 && next.bottom.lives <= 0) finish(next);
  }, [finish, game, screen, timeLeft]);

  const correct = game.top.correct + game.bottom.correct;
  const wrong = game.top.wrong + game.bottom.wrong;
  const coins = rewardCoins(game.score, correct > wrong);

  return (
    <GameScreen title="ДУЭЛЬ УМОВ" accent={accent} skin={skin} onExit={onExit} right={<CoinPill value={initialCoins + coins} />}>
      {screen === "menu" ? <StartCard icon="head-cog-outline" title="ДУЭЛЬ УМОВ" subtitle="Многозадачность" accent={accent} details={["Два примера работают одновременно", "Реши: показанный ответ верный или нет", "У каждого поля по три жизни"]} onStart={begin} /> : null}
      {screen === "play" ? (
        <View style={styles.play}>
          <DuelField side="top" label="ПОЛЕ A" field={game.top} accent={accent} onAnswer={(value) => answer("top", value)} />
          <View style={styles.centerBar}>
            <Metric label="ВРЕМЯ" value={timeLeft} color={timeLeft <= 10 ? B_COLORS.red : B_COLORS.gold} />
            <View style={styles.centralScore}>
              <Text style={[styles.score, { color: accent }]}>{rewardCoins(game.score)} coin</Text>
              <View style={styles.comboRow}>
                {game.combo >= 2 ? <ArcadeIcon name="fire" size={10} color="#FF9D45" /> : null}
                <Text style={styles.combo}>{game.combo >= 2 ? `x${game.combo}` : "FOCUS"}</Text>
              </View>
            </View>
            <Metric label="TOTAL" value={correct} color={B_COLORS.green} />
          </View>
          <DuelField side="bottom" label="ПОЛЕ B" field={game.bottom} accent={secondaryAccent} onAnswer={(value) => answer("bottom", value)} />
        </View>
      ) : null}
      {screen === "result" ? (
        <ResultCard icon={correct > wrong ? "trophy-outline" : "head-cog-outline"} title={correct > wrong ? "СИЛЬНАЯ ИГРА" : "ЕЩЁ ОДИН РАУНД"} score={game.score} coins={coins} accent={accent} stats={[{ label: "ВЕРНО", value: correct }, { label: "ОШИБКИ", value: wrong }, { label: "КОМБО", value: game.maxCombo }]} onReplay={begin} onExit={onExit} />
      ) : null}
    </GameScreen>
  );
}

function DuelField({ side, label, field, accent, onAnswer }: { side: "top" | "bottom"; label: string; field: Field; accent: string; onAnswer: (value: boolean) => void }) {
  const disabled = field.lives <= 0;
  return (
    <LinearGradient colors={side === "top" ? ["#14082C", "#0B1025"] : ["#271006", "#14101A"]} style={[styles.field, disabled && styles.fieldDisabled]}>
      <View style={styles.fieldHeader}>
        <View style={styles.lives}>{Array.from({ length: MAX_LIVES }, (_, index) => <ArcadeIcon key={index} name={index < field.lives ? "heart" : "heart-outline"} size={15} color={index < field.lives ? B_COLORS.red : "rgba(255,255,255,.12)"} />)}</View>
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <ProgressTrack value={field.lives / MAX_LIVES} color={field.lives <= 1 ? B_COLORS.red : accent} />
      <Animated.View key={`${side}-${field.correct}-${field.wrong}`} entering={FadeInDown.duration(220)} style={styles.equation}>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.expression}>{field.question.expression}</Text>
        <Text style={styles.shownAnswer}>{field.question.shownAnswer}<Text style={{ color: accent }}>?</Text></Text>
      </Animated.View>
      <View style={styles.answerRow}>
        <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label}: ответ верный`} onPress={() => onAnswer(true)} style={({ pressed }) => [styles.duelButton, styles.trueButton, pressed && styles.pressed]}><ArcadeIcon name="check-bold" size={25} color="#FFFFFF" /></Pressable>
        <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label}: ответ неверный`} onPress={() => onAnswer(false)} style={({ pressed }) => [styles.duelButton, styles.falseButton, pressed && styles.pressed]}><ArcadeIcon name="close-thick" size={25} color="#FFFFFF" /></Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  play: { flex: 1, width: "100%", maxWidth: 560, alignSelf: "center", gap: 8 },
  field: { flex: 1, minHeight: 0, borderRadius: 22, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,.09)", overflow: "hidden" },
  fieldDisabled: { opacity: 0.34 },
  fieldHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  lives: { flexDirection: "row", gap: 4 },
  fieldLabel: { color: B_COLORS.muted, fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  equation: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  expression: { color: B_COLORS.ink, fontSize: 37, fontWeight: "900" },
  shownAnswer: { color: "rgba(255,255,255,.48)", fontSize: 30, fontWeight: "900" },
  answerRow: { flexDirection: "row", gap: 9 },
  duelButton: { flex: 1, height: 52, borderRadius: 15, alignItems: "center", justifyContent: "center", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  trueButton: { backgroundColor: "#169D58", shadowColor: B_COLORS.green },
  falseButton: { backgroundColor: "#C83B50", shadowColor: B_COLORS.red },
  pressed: { transform: [{ scale: 0.94 }] },
  centerBar: { height: 52, borderRadius: 16, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, backgroundColor: "rgba(13,7,28,.94)", borderWidth: 1, borderColor: "rgba(168,121,255,.16)" },
  centralScore: { minWidth: 90, alignItems: "center" },
  score: { color: B_COLORS.gold, fontSize: 21, lineHeight: 22, fontWeight: "900" },
  comboRow: { minHeight: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
  combo: { color: B_COLORS.muted, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
});
