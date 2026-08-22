import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ArcadeIcon, type ArcadeIconName } from "./icons";
import type { ArcadeGameProps } from "./types";
import { AnswerButton, arcadeSkinAccent, B_COLORS, CoinPill, errorTap, GameScreen, Metric, Panel, ProgressTrack, ResultCard, StartCard, successTap } from "./ui";
import { rewardCoins, shuffle, shuffleAvoidingFirst } from "./utils";

type GeoDifficulty = "easy" | "medium" | "hard";
type GeoCategory = "all" | "capitals" | "flags" | "world";
type GeoQuestion = { prompt: string; answers: [string, string, string, string]; correct: number; category: Exclude<GeoCategory, "all">; difficulty: GeoDifficulty; icon: ArcadeIconName };

const QUESTIONS: readonly GeoQuestion[] = [
  { prompt: "Столица Франции?", answers: ["Лион", "Париж", "Марсель", "Ницца"], correct: 1, category: "capitals", difficulty: "easy", icon: "city-variant-outline" },
  { prompt: "Столица Японии?", answers: ["Осака", "Киото", "Токио", "Саппоро"], correct: 2, category: "capitals", difficulty: "easy", icon: "city-variant-outline" },
  { prompt: "Столица Австралии?", answers: ["Сидней", "Канберра", "Мельбурн", "Перт"], correct: 1, category: "capitals", difficulty: "medium", icon: "city-variant-outline" },
  { prompt: "Столица Канады?", answers: ["Торонто", "Ванкувер", "Монреаль", "Оттава"], correct: 3, category: "capitals", difficulty: "medium", icon: "city-variant-outline" },
  { prompt: "Столица Боливии по конституции?", answers: ["Ла-Пас", "Сукре", "Кито", "Лима"], correct: 1, category: "capitals", difficulty: "hard", icon: "city-variant-outline" },
  { prompt: "Столица Бутана?", answers: ["Тхимпху", "Катманду", "Дакка", "Коломбо"], correct: 0, category: "capitals", difficulty: "hard", icon: "city-variant-outline" },
  { prompt: "Синий, белый и зелёный флаг с полумесяцем?", answers: ["Казахстан", "Узбекистан", "Таджикистан", "Азербайджан"], correct: 1, category: "flags", difficulty: "easy", icon: "flag-variant-outline" },
  { prompt: "Зелёный флаг с жёлтым ромбом и синим кругом?", answers: ["Бразилия", "Аргентина", "Перу", "Мексика"], correct: 0, category: "flags", difficulty: "easy", icon: "flag-variant-outline" },
  { prompt: "У какой страны флаг из двух треугольных вымпелов?", answers: ["Непал", "Бутан", "Лаос", "Монголия"], correct: 0, category: "flags", difficulty: "medium", icon: "flag-variant-outline" },
  { prompt: "На флаге какой страны изображён автомат?", answers: ["Мозамбик", "Малави", "Замбия", "Ангола"], correct: 0, category: "flags", difficulty: "hard", icon: "flag-variant-outline" },
  { prompt: "На чьём флаге фрегат, солнце и волны?", answers: ["Фиджи", "Кирибати", "Тонга", "Науру"], correct: 1, category: "flags", difficulty: "hard", icon: "flag-variant-outline" },
  { prompt: "Самый большой океан?", answers: ["Атлантический", "Индийский", "Тихий", "Северный Ледовитый"], correct: 2, category: "world", difficulty: "easy", icon: "waves" },
  { prompt: "Самая высокая гора мира?", answers: ["Килиманджаро", "Эверест", "Эльбрус", "Аконкагуа"], correct: 1, category: "world", difficulty: "easy", icon: "image-filter-hdr" },
  { prompt: "Самая длинная река Южной Америки?", answers: ["Ориноко", "Парана", "Амазонка", "Мадейра"], correct: 2, category: "world", difficulty: "medium", icon: "map-marker-distance" },
  { prompt: "Какой пролив разделяет Азию и Северную Америку?", answers: ["Гибралтарский", "Берингов", "Малаккский", "Босфор"], correct: 1, category: "world", difficulty: "medium", icon: "compass-outline" },
  { prompt: "Самая глубокая точка океана?", answers: ["Тонга", "Марианская впадина", "Пуэрто-Рико", "Яванский желоб"], correct: 1, category: "world", difficulty: "hard", icon: "earth" },
  { prompt: "В какой стране находится пустыня Атакама?", answers: ["Перу", "Чили", "Аргентина", "Боливия"], correct: 1, category: "world", difficulty: "hard", icon: "weather-sunny" },
  { prompt: "На каком материке находится Египет?", answers: ["Азия", "Африка", "Европа", "Южная Америка"], correct: 1, category: "world", difficulty: "easy", icon: "earth" },
  { prompt: "Столица Италии?", answers: ["Милан", "Рим", "Неаполь", "Турин"], correct: 1, category: "capitals", difficulty: "easy", icon: "city-variant-outline" },
  { prompt: "Столица Новой Зеландии?", answers: ["Окленд", "Крайстчерч", "Веллингтон", "Гамильтон"], correct: 2, category: "capitals", difficulty: "medium", icon: "city-variant-outline" },
  { prompt: "У какой страны квадратный красный флаг с белым крестом?", answers: ["Швейцария", "Дания", "Австрия", "Швеция"], correct: 0, category: "flags", difficulty: "medium", icon: "flag-variant-outline" },
  { prompt: "На чьём флаге пять диагональных цветных лучей?", answers: ["Самоа", "Сейшелы", "Сенегал", "Сингапур"], correct: 1, category: "flags", difficulty: "hard", icon: "flag-variant-outline" },
  { prompt: "Какой континент самый маленький?", answers: ["Европа", "Антарктида", "Австралия", "Южная Америка"], correct: 2, category: "world", difficulty: "medium", icon: "map-outline" },
  { prompt: "Какое море не имеет берегов?", answers: ["Саргассово", "Карибское", "Коралловое", "Тасманово"], correct: 0, category: "world", difficulty: "hard", icon: "waves" },
];

const CATEGORIES: { id: GeoCategory; label: string }[] = [
  { id: "all", label: "ВСЕ" },
  { id: "capitals", label: "СТОЛИЦЫ" },
  { id: "flags", label: "ФЛАГИ" },
  { id: "world", label: "МИР" },
];
const DIFFICULTIES: { id: GeoDifficulty; label: string }[] = [
  { id: "easy", label: "ЛЕГКО" },
  { id: "medium", label: "НОРМА" },
  { id: "hard", label: "ХАРД" },
];
const ROUND_LENGTH = 12;
const TIMER_BY_DIFFICULTY: Record<GeoDifficulty, number> = { easy: 30, medium: 25, hard: 20 };

export function GeographyQuizGame({ onExit, onFinish, initialCoins = 0, extraTimeSeconds = 0, skin }: ArcadeGameProps) {
  const accent = arcadeSkinAccent(skin, B_COLORS.cyan);
  const timeBonus = Math.max(0, extraTimeSeconds);
  const [screen, setScreen] = useState<"menu" | "play" | "result">("menu");
  const [category, setCategory] = useState<GeoCategory>("all");
  const [difficulty, setDifficulty] = useState<GeoDifficulty>("easy");
  const [round, setRound] = useState<GeoQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [selected, setSelected] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef(0);
  const deadline = useRef(0);
  const previousFirstQuestion = useRef<GeoQuestion | undefined>(undefined);

  const finish = useCallback((finalScore: number, finalCorrect: number, finalStreak: number) => {
    const coins = rewardCoins(finalScore, finalCorrect >= 6);
    const durationMs = Date.now() - startedAt.current;
    setScreen("result");
    onFinish?.({
      gameId: "geo-master",
      score: finalScore,
      coins,
      won: finalCorrect >= 6,
      durationMs,
      details: { correct: finalCorrect, total: ROUND_LENGTH, streak: finalStreak, difficulty },
    });
  }, [difficulty, onFinish]);

  const advance = useCallback((nextScore = score, nextCorrect = correct, nextMaxStreak = maxStreak) => {
    if (index + 1 >= round.length) {
      finish(nextScore, nextCorrect, nextMaxStreak);
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
    setTimedOut(false);
    const seconds = TIMER_BY_DIFFICULTY[difficulty] + timeBonus;
    setTimeLeft(seconds);
    deadline.current = Date.now() + seconds * 1000;
  }, [correct, difficulty, finish, index, maxStreak, round.length, score, timeBonus]);

  useEffect(() => {
    if (screen !== "play" || selected !== null || timedOut) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, (deadline.current - Date.now()) / 1000);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setTimedOut(true);
        setStreak(0);
        errorTap();
        setTimeout(() => advance(), 700);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [advance, screen, selected, timedOut]);

  const begin = useCallback(() => {
    const exact = QUESTIONS.filter((question) => (category === "all" || question.category === category) && question.difficulty === difficulty);
    const categoryPool = QUESTIONS.filter((question) => category === "all" || question.category === category);
    const pool = exact.length >= ROUND_LENGTH ? exact : [...exact, ...shuffle(categoryPool.filter((question) => !exact.includes(question)))];
    const selectedQuestions = shuffleAvoidingFirst(
      pool.length >= ROUND_LENGTH ? pool : QUESTIONS,
      previousFirstQuestion.current,
    ).slice(0, ROUND_LENGTH);
    previousFirstQuestion.current = selectedQuestions[0];
    setRound(selectedQuestions);
    setIndex(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrect(0);
    setSelected(null);
    setTimedOut(false);
    const seconds = TIMER_BY_DIFFICULTY[difficulty] + timeBonus;
    setTimeLeft(seconds);
    deadline.current = Date.now() + seconds * 1000;
    startedAt.current = Date.now();
    setScreen("play");
  }, [category, difficulty, timeBonus]);

  const answer = useCallback((answerIndex: number) => {
    if (selected !== null || timedOut) return;
    const question = round[index];
    if (!question) return;
    setSelected(answerIndex);
    if (answerIndex === question.correct) {
      const points = 100 + Math.floor(timeLeft * 3) + (streak >= 2 ? streak * 10 : 0);
      const nextScore = score + points;
      const nextStreak = streak + 1;
      const nextCorrect = correct + 1;
      const nextMax = Math.max(maxStreak, nextStreak);
      setScore(nextScore);
      setStreak(nextStreak);
      setCorrect(nextCorrect);
      setMaxStreak(nextMax);
      successTap();
      setTimeout(() => advance(nextScore, nextCorrect, nextMax), 650);
    } else {
      setStreak(0);
      errorTap();
      setTimeout(() => advance(score, correct, maxStreak), 850);
    }
  }, [advance, correct, index, maxStreak, round, score, selected, streak, timeLeft, timedOut]);

  const current = round[index];
  const earnedCoins = useMemo(() => rewardCoins(score, correct >= 6), [correct, score]);

  return (
    <GameScreen title="ГЕО МАСТЕР" accent={accent} skin={skin} onExit={onExit} right={<CoinPill value={initialCoins + earnedCoins} />}>
      {screen === "menu" ? (
        <StartCard
          icon="earth"
          title="ГЕО МАСТЕР"
          subtitle="География мира"
          accent={accent}
          details={["12 случайных вопросов", "Coin за скорость и серию", "Разбор результата после раунда"]}
          options={<View style={styles.pickers}><ChoiceRow items={CATEGORIES} value={category} accent={accent} onChange={setCategory} /><ChoiceRow items={DIFFICULTIES} value={difficulty} accent={accent} onChange={setDifficulty} /></View>}
          onStart={begin}
        />
      ) : null}

      {screen === "play" && current ? (
        <View style={styles.play}>
          <View style={styles.metrics}>
            <Metric label="ВОПРОС" value={`${index + 1}/${ROUND_LENGTH}`} color={accent} />
            <Metric label="СЕРИЯ" value={`×${streak}`} color={B_COLORS.gold} />
            <Metric label="ВРЕМЯ" value={Math.ceil(timeLeft)} color={timeLeft <= 5 ? B_COLORS.red : accent} />
            <Metric label="COIN" value={rewardCoins(score, correct >= 6)} color={B_COLORS.gold} />
          </View>
          <ProgressTrack value={(index + 1) / ROUND_LENGTH} color={accent} />
          <Animated.View key={`${index}-${current.prompt}`} entering={FadeInDown.duration(260)} style={styles.questionArea}>
            <Panel style={styles.questionCard}>
              <View style={[styles.questionIcon, { borderColor: accent }]}>
                <ArcadeIcon name={current.icon} size={42} color={accent} />
              </View>
              <Text style={styles.question}>{current.prompt}</Text>
            </Panel>
            <View style={styles.answers}>
              {current.answers.map((label, answerIndex) => {
                const state = selected === null && !timedOut
                  ? "idle"
                  : answerIndex === current.correct
                    ? "correct"
                    : selected === answerIndex
                      ? "wrong"
                      : "dim";
                return <AnswerButton key={label} label={label} onPress={() => answer(answerIndex)} accent={accent} state={state} disabled={selected !== null || timedOut} />;
              })}
            </View>
          </Animated.View>
        </View>
      ) : null}

      {screen === "result" ? (
        <ResultCard
          icon={correct >= 10 ? "trophy-outline" : correct >= 6 ? "star-four-points-outline" : "book-open-page-variant-outline"}
          title={correct >= 10 ? "ЛЕГЕНДА!" : correct >= 6 ? "ОТЛИЧНО!" : "ЕЩЁ РАЗ"}
          score={score}
          coins={earnedCoins}
          accent={accent}
          stats={[{ label: "ВЕРНО", value: `${correct}/${ROUND_LENGTH}` }, { label: "СЕРИЯ", value: maxStreak }, { label: "ТОЧНОСТЬ", value: `${Math.round(correct / ROUND_LENGTH * 100)}%` }]}
          onReplay={begin}
          onExit={onExit}
        />
      ) : null}
    </GameScreen>
  );
}

function ChoiceRow<T extends string>({ items, value, accent, onChange }: { items: { id: T; label: string }[]; value: T; accent: string; onChange: (value: T) => void }) {
  return (
    <View style={styles.choiceRow}>
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => onChange(item.id)} style={[styles.choice, value === item.id && styles.choiceActive, value === item.id && { borderColor: accent }]}>
          <Text style={[styles.choiceText, value === item.id && styles.choiceTextActive, value === item.id && { color: accent }]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pickers: { width: "100%", gap: 8 },
  choiceRow: { flexDirection: "row", gap: 7 },
  choice: { flex: 1, minHeight: 34, paddingHorizontal: 7, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: B_COLORS.panelSoft, borderWidth: 1, borderColor: B_COLORS.border },
  choiceActive: { backgroundColor: "rgba(46,232,255,.12)", borderColor: "rgba(46,232,255,.5)" },
  choiceText: { color: B_COLORS.muted, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  choiceTextActive: { color: B_COLORS.cyan },
  play: { flex: 1, width: "100%", maxWidth: 600, alignSelf: "center", gap: 12 },
  metrics: { flexDirection: "row", gap: 5, paddingVertical: 4 },
  questionArea: { flex: 1, justifyContent: "center", gap: 12 },
  questionCard: { minHeight: 170, alignItems: "center", justifyContent: "center", gap: 10 },
  questionIcon: { width: 68, height: 68, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(46,232,255,.08)", borderWidth: 1, borderColor: "rgba(46,232,255,.22)" },
  question: { color: B_COLORS.ink, fontSize: 23, lineHeight: 30, fontWeight: "900", textAlign: "center" },
  answers: { gap: 8 },
});
