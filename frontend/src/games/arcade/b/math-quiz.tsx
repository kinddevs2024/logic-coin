import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ArcadeIcon, MATH_OPERATION_ICONS } from "./icons";
import type { ArcadeGameProps } from "./types";
import { AnswerButton, arcadeSkinAccent, B_COLORS, CoinPill, errorTap, GameScreen, Metric, Panel, ProgressTrack, ResultCard, StartCard, successTap } from "./ui";
import { randomInt, rewardCoins, shuffle } from "./utils";
import { usePauseClock } from "@/games/pause-clock";

type MathQuestion = { expression: string; answer: number; op: "+" | "−" | "×" | "÷"; double: boolean; hard: boolean; options: number[] };

const TOTAL = 15;
function makeQuestionOnce(hard: boolean): MathQuestion {
  const operators: MathQuestion["op"][] = hard ? ["+", "−", "×", "÷", "×", "÷"] : ["+", "+", "−", "×", "÷"];
  const op = operators[randomInt(0, operators.length - 1)];
  const double = hard || Math.random() < 0.28;
  let expression = "";
  let answer = 0;
  if (op === "+") {
    const a = randomInt(hard ? 22 : 8, hard ? 80 : 55);
    const b = randomInt(8, hard ? 55 : 38);
    const c = double ? randomInt(4, hard ? 30 : 18) : 0;
    expression = double ? `${a} + ${b} + ${c}` : `${a} + ${b}`;
    answer = a + b + c;
  } else if (op === "−") {
    const b = randomInt(5, hard ? 38 : 25);
    const c = double ? randomInt(2, Math.max(3, Math.floor(b / 2))) : 0;
    const a = randomInt(b + c + 8, hard ? 110 : 78);
    expression = double ? `${a} − ${b} − ${c}` : `${a} − ${b}`;
    answer = a - b - c;
  } else if (op === "×") {
    const a = randomInt(2, hard ? 9 : 7);
    const b = randomInt(hard ? 11 : 6, hard ? 18 : 14);
    const c = double ? randomInt(4, hard ? 28 : 15) : 0;
    expression = double ? `${a} × ${b} + ${c}` : `${a} × ${b}`;
    answer = a * b + c;
  } else {
    const divisor = randomInt(2, hard ? 9 : 7);
    const quotient = randomInt(4, hard ? 18 : 13);
    const c = double ? randomInt(2, hard ? 18 : 10) : 0;
    expression = double ? `${divisor * quotient} ÷ ${divisor} + ${c}` : `${divisor * quotient} ÷ ${divisor}`;
    answer = quotient + c;
  }
  const candidates = new Set<number>([answer]);
  while (candidates.size < 4) {
    const spread = randomInt(1, op === "×" ? 16 : 10) * (Math.random() < 0.5 ? -1 : 1);
    if (answer + spread > 0) candidates.add(answer + spread);
  }
  return { expression, answer, op, double, hard, options: shuffle([...candidates]) };
}

function makeQuestion(hard: boolean, previousExpression?: string): MathQuestion {
  let question = makeQuestionOnce(hard);
  for (let attempt = 0; attempt < 12 && question.expression === previousExpression; attempt += 1) {
    question = makeQuestionOnce(hard);
  }
  return question;
}

function buildRound(): MathQuestion[] {
  const questions: MathQuestion[] = [];
  for (let index = 0; index < TOTAL; index += 1) {
    questions.push(makeQuestion(index >= 11, questions[questions.length - 1]?.expression));
  }
  return questions;
}

export function MathQuizGame({ onExit, onFinish, initialCoins = 0, extraTimeSeconds = 0, paused = false, skin }: ArcadeGameProps) {
  const accent = arcadeSkinAccent(skin, B_COLORS.gold);
  const timeBonus = Math.max(0, extraTimeSeconds);
  const [screen, setScreen] = useState<"menu" | "play" | "result">("menu");
  const [questions, setQuestions] = useState<MathQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [timeouts, setTimeouts] = useState(0);
  const [timeLeft, setTimeLeft] = useState(7.5);
  const [selected, setSelected] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef(0);
  const deadline = useRef(0);
  usePauseClock(paused, [startedAt, deadline]);

  const question = questions[index];
  const duration = (question?.double ? 12.5 : 7.5) + timeBonus;

  const finish = useCallback((finalScore: number, finalCorrect: number, finalWrong: number, finalTimeouts: number, finalMaxStreak: number) => {
    const won = finalCorrect >= 8;
    const durationMs = Date.now() - startedAt.current;
    setScreen("result");
    onFinish?.({
      gameId: "math-quiz",
      score: finalScore,
      coins: rewardCoins(finalScore, won),
      won,
      durationMs,
      details: { correct: finalCorrect, wrong: finalWrong, timeouts: finalTimeouts, streak: finalMaxStreak },
    });
  }, [onFinish]);

  const advance = useCallback((values?: { score?: number; correct?: number; wrong?: number; timeouts?: number; maxStreak?: number }) => {
    const finalScore = values?.score ?? score;
    const finalCorrect = values?.correct ?? correct;
    const finalWrong = values?.wrong ?? wrong;
    const finalTimeouts = values?.timeouts ?? timeouts;
    const finalMaxStreak = values?.maxStreak ?? maxStreak;
    if (index + 1 >= TOTAL) {
      finish(finalScore, finalCorrect, finalWrong, finalTimeouts, finalMaxStreak);
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setSelected(null);
    setTimedOut(false);
    const nextDuration = (questions[nextIndex]?.double ? 12.5 : 7.5) + timeBonus;
    setTimeLeft(nextDuration);
    deadline.current = Date.now() + nextDuration * 1000;
  }, [correct, finish, index, maxStreak, questions, score, timeBonus, timeouts, wrong]);

  useEffect(() => {
    if (screen !== "play" || selected !== null || timedOut || paused) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, (deadline.current - Date.now()) / 1000);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        const nextTimeouts = timeouts + 1;
        setTimeouts(nextTimeouts);
        setStreak(0);
        setTimedOut(true);
        errorTap();
        setTimeout(() => advance({ timeouts: nextTimeouts }), 700);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [advance, paused, screen, selected, timedOut, timeouts]);

  const begin = useCallback(() => {
    const nextQuestions = buildRound();
    setQuestions(nextQuestions);
    setIndex(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrect(0);
    setWrong(0);
    setTimeouts(0);
    setSelected(null);
    setTimedOut(false);
    const nextDuration = (nextQuestions[0].double ? 12.5 : 7.5) + timeBonus;
    setTimeLeft(nextDuration);
    deadline.current = Date.now() + nextDuration * 1000;
    startedAt.current = Date.now();
    setScreen("play");
  }, [timeBonus]);

  const answer = useCallback((value: number) => {
    if (!question || selected !== null || timedOut) return;
    setSelected(value);
    if (value === question.answer) {
      const timeBonus = Math.ceil(timeLeft / duration * 10);
      const streakBonus = Math.min(streak, 5) * 5;
      const points = 10 + timeBonus + streakBonus;
      const nextScore = score + points;
      const nextStreak = streak + 1;
      const nextCorrect = correct + 1;
      const nextMax = Math.max(maxStreak, nextStreak);
      setScore(nextScore);
      setStreak(nextStreak);
      setCorrect(nextCorrect);
      setMaxStreak(nextMax);
      successTap();
      setTimeout(() => advance({ score: nextScore, correct: nextCorrect, maxStreak: nextMax }), 650);
    } else {
      const nextWrong = wrong + 1;
      setWrong(nextWrong);
      setStreak(0);
      errorTap();
      setTimeout(() => advance({ wrong: nextWrong }), 750);
    }
  }, [advance, correct, duration, maxStreak, question, score, selected, streak, timeLeft, timedOut, wrong]);

  const answerState = useCallback((option: number) => {
    if (!question || (selected === null && !timedOut)) return "idle" as const;
    if (option === question.answer) return "correct" as const;
    if (option === selected) return "wrong" as const;
    return "dim" as const;
  }, [question, selected, timedOut]);

  const accuracy = Math.round(correct / TOTAL * 100);
  const coins = useMemo(() => rewardCoins(score, correct >= 8), [correct, score]);

  return (
    <GameScreen title="МАТЕМ" accent={accent} skin={skin} onExit={onExit} right={<CoinPill value={initialCoins + coins} />}>
      {screen === "menu" ? <StartCard icon="calculator-variant-outline" title="МАТЕМ" subtitle="Тест по математике" accent={accent} details={["15 заданий на четыре действия", "7.5 секунд или 12.5 для цепочек", "Серия увеличивает награду"]} onStart={begin} /> : null}
      {screen === "play" && question ? (
        <View style={styles.play}>
          <View style={styles.topRow}>
            <Metric label="ВОПРОС" value={`${index + 1}/${TOTAL}`} color={accent} />
            <Metric label="СЕРИЯ" value={`×${streak}`} color="#FF9D45" />
            <Metric label="COIN" value={rewardCoins(score, correct >= 8)} color={accent} />
          </View>
          <ProgressTrack value={(index + 1) / TOTAL} color={accent} />
          <View style={styles.timerWrap}>
            <View style={[styles.timer, { borderColor: timeLeft / duration < 0.3 ? B_COLORS.red : accent }]}>
              <Text style={[styles.timerText, { color: timeLeft / duration < 0.3 ? B_COLORS.red : B_COLORS.ink }]}>{Math.ceil(timeLeft)}</Text>
            </View>
          </View>
          <Animated.View key={`${index}-${question.expression}`} entering={FadeInDown.duration(240)} style={styles.questionWrap}>
            <Text style={styles.badge}>{question.double ? `ДВА ДЕЙСТВИЯ · 12.5С${question.hard ? " · HARD" : ""}` : "ОДНО ДЕЙСТВИЕ · 7.5С"}</Text>
            <Panel style={styles.questionCard}>
              <View style={styles.questionIcon}>
                <ArcadeIcon name={MATH_OPERATION_ICONS[question.op][index % MATH_OPERATION_ICONS[question.op].length]} size={28} color={accent} />
              </View>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.expression}>{question.expression} = ?</Text>
            </Panel>
            <View style={styles.answers}>
              {question.options.map((option) => <View key={option} style={styles.answerSlot}><AnswerButton label={String(option)} onPress={() => answer(option)} accent={accent} state={answerState(option)} disabled={selected !== null || timedOut} /></View>)}
            </View>
          </Animated.View>
        </View>
      ) : null}
      {screen === "result" ? (
        <ResultCard icon={accuracy === 100 ? "trophy-outline" : accuracy >= 67 ? "medal-outline" : "arm-flex-outline"} title={accuracy === 100 ? "ИДЕАЛЬНО" : accuracy >= 67 ? "ОТЛИЧНО" : "ТРЕНИРУЙСЯ"} score={score} coins={coins} accent={accent} stats={[{ label: "ВЕРНО", value: `${correct}/${TOTAL}` }, { label: "ТОЧНОСТЬ", value: `${accuracy}%` }, { label: "СЕРИЯ", value: maxStreak }]} onReplay={begin} onExit={onExit} />
      ) : null}
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  play: { flex: 1, width: "100%", maxWidth: 560, alignSelf: "center", gap: 10 },
  topRow: { flexDirection: "row", gap: 7 },
  timerWrap: { alignItems: "center", marginVertical: 3 },
  timer: { width: 68, height: 68, borderRadius: 34, borderWidth: 5, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.035)" },
  timerText: { fontSize: 25, fontWeight: "900" },
  questionWrap: { flex: 1, justifyContent: "center", gap: 11 },
  badge: { color: B_COLORS.muted, textAlign: "center", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  questionCard: { minHeight: 150, alignItems: "center", justifyContent: "center", gap: 8 },
  questionIcon: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,216,90,.08)", borderWidth: 1, borderColor: "rgba(255,216,90,.2)" },
  expression: { color: B_COLORS.ink, fontSize: 34, fontWeight: "900", letterSpacing: 0.5 },
  answers: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  answerSlot: { width: "48%", flexGrow: 1 },
});
