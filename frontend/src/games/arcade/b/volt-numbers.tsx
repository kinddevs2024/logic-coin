import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";

import { ArcadeIcon } from "./icons";
import type { ArcadeGameProps } from "./types";
import { arcadeSkinAccent, B_COLORS, CoinPill, errorTap, GameButton, GameScreen, Metric, Panel, ProgressTrack, ResultCard, StartCard, successTap } from "./ui";
import { clamp, rewardCoins, shuffle, shuffleAvoidingFirst } from "./utils";

type VoltDifficulty = "easy" | "normal" | "hard";
type Phase = "menu" | "look" | "play" | "result";

const CONFIG: Record<VoltDifficulty, { count: number; label: string; columns: number }> = {
  easy: { count: 35, label: "ЛЕГКО", columns: 7 },
  normal: { count: 50, label: "НОРМА", columns: 8 },
  hard: { count: 70, label: "ХАРД", columns: 10 },
};
const PALETTES = ["#7C3AED", "#B45309", "#0369A1", "#067A57", "#9D174D", "#1D4ED8", "#B91C1C", "#0F766E", "#7E22CE", "#C2410C"];

export function VoltNumbersGame({ onExit, onFinish, initialCoins = 0, skin }: ArcadeGameProps) {
  const { width } = useWindowDimensions();
  const accent = arcadeSkinAccent(skin, B_COLORS.gold);
  const palette = skin && skin.id !== "classic"
    ? PALETTES.map((color, index) => index % 3 === 0 ? skin.primary : index % 3 === 1 ? skin.secondary : color)
    : PALETTES;
  const [phase, setPhase] = useState<Phase>("menu");
  const [difficulty, setDifficulty] = useState<VoltDifficulty>("normal");
  const [order, setOrder] = useState<number[]>([]);
  const [remaining, setRemaining] = useState<Set<number>>(new Set());
  const [current, setCurrent] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const startedAt = useRef(0);

  const config = CONFIG[difficulty];
  const okTaps = config.count - remaining.size;
  const score = won ? Math.max(100, Math.round(10000 - elapsed * 48 - mistakes * 400)) : okTaps * 20;
  const coins = rewardCoins(score, won);

  useEffect(() => {
    if (phase !== "play") return;
    const interval = setInterval(() => setElapsed(Date.now() - startedAt.current), 100);
    return () => clearInterval(interval);
  }, [phase]);

  const begin = useCallback(() => {
    const numbers = shuffle(Array.from({ length: CONFIG[difficulty].count }, (_, index) => index + 1));
    setOrder(numbers);
    setRemaining(new Set(numbers));
    setCurrent(CONFIG[difficulty].count);
    setMistakes(0);
    setElapsed(0);
    setWon(false);
    setPhase("look");
  }, [difficulty]);

  const activate = useCallback(() => {
    setOrder((numbers) => shuffleAvoidingFirst(numbers, numbers[0]));
    startedAt.current = Date.now();
    setElapsed(0);
    setPhase("play");
    successTap();
  }, []);

  const finish = useCallback((didWin: boolean, finalMistakes: number, finalElapsed: number, finalOk: number) => {
    const finalScore = didWin ? Math.max(100, Math.round(10000 - finalElapsed * 48 - finalMistakes * 400)) : finalOk * 20;
    setWon(didWin);
    setElapsed(finalElapsed);
    setPhase("result");
    onFinish?.({
      gameId: "volt-numbers",
      score: finalScore,
      coins: rewardCoins(finalScore, didWin),
      won: didWin,
      durationMs: finalElapsed,
      details: { difficulty, correct: finalOk, mistakes: finalMistakes, total: CONFIG[difficulty].count },
    });
  }, [difficulty, onFinish]);

  const tapNumber = useCallback((number: number) => {
    if (phase === "look") {
      if (number === config.count) activate();
      else errorTap();
      return;
    }
    if (phase !== "play" || !remaining.has(number)) return;
    if (number === current) {
      const nextRemaining = new Set(remaining);
      nextRemaining.delete(number);
      setRemaining(nextRemaining);
      setCurrent(number - 1);
      successTap();
      if (number === 1) finish(true, mistakes, Date.now() - startedAt.current, config.count);
    } else {
      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes);
      errorTap();
      if (nextMistakes >= 3) finish(false, nextMistakes, Date.now() - startedAt.current, config.count - remaining.size);
    }
  }, [activate, config.count, current, finish, mistakes, phase, remaining]);

  const boardWidth = Math.min(460, width - 32);
  const gap = config.columns >= 10 ? 3 : 5;
  const ballSize = clamp((boardWidth - gap * (config.columns - 1)) / config.columns, 28, 50);
  const accuracy = Math.round((okTaps / Math.max(1, okTaps + mistakes)) * 100);

  return (
    <GameScreen title="VOLT · NUMBERS" accent={accent} skin={skin} onExit={onExit} right={<CoinPill value={initialCoins + coins} />}>
      {phase === "menu" ? (
        <StartCard
          icon="counter"
          title="VOLT"
          subtitle="Numbers · Speed of Thought"
          accent={accent}
          details={["Запомни расположение чисел", "После перемешивания жми по убыванию", "Три ошибки завершают попытку"]}
          options={<View style={styles.difficultyRow}>
            {(Object.keys(CONFIG) as VoltDifficulty[]).map((value) => (
              <Pressable key={value} onPress={() => setDifficulty(value)} style={[styles.difficulty, difficulty === value && styles.difficultyActive]}>
                <Text style={[styles.difficultyLabel, difficulty === value && { color: accent }]}>{CONFIG[value].label}</Text>
                <Text style={styles.difficultyCount}>{CONFIG[value].count}</Text>
              </Pressable>
            ))}
          </View>}
          onStart={begin}
        />
      ) : null}

      {phase === "look" || phase === "play" ? (
        <View style={styles.play}>
          <View style={styles.metrics}>
            <Metric label="ВРЕМЯ" value={`${(elapsed / 1000).toFixed(1)}с`} color={accent} />
            <Metric label="ОСТАЛОСЬ" value={remaining.size} color={B_COLORS.ink} />
            <Metric label="ИЩИ" value={phase === "look" ? config.count : current} color={accent} />
          </View>
          <View style={styles.progressInfo}><Text style={styles.progressLabel}>{config.label}</Text><Text style={styles.progressLabel}>{Math.round(okTaps / config.count * 100)}%</Text></View>
          <ProgressTrack value={okTaps / config.count} color={accent} />
          <Panel style={styles.arena}>
            <View style={[styles.ballGrid, { width: boardWidth, gap }]}>
              {order.map((number) => remaining.has(number) ? (
                <Animated.View key={number} entering={ZoomIn.duration(180)} exiting={FadeOut.duration(180)}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Число ${number}`}
                    onPress={() => tapNumber(number)}
                    style={({ pressed }) => [styles.ball, { width: ballSize, height: ballSize, borderRadius: ballSize / 2, backgroundColor: phase === "look" && number === config.count ? accent : palette[number % palette.length] }, pressed && styles.ballPressed]}
                  >
                    <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.ballText, { fontSize: Math.max(10, ballSize * 0.36), color: phase === "look" && number === config.count ? "#261900" : B_COLORS.ink }]}>{number}</Text>
                  </Pressable>
                </Animated.View>
              ) : <View key={number} style={{ width: ballSize, height: ballSize }} />)}
            </View>
            {phase === "look" ? (
              <Animated.View entering={FadeIn.delay(250)} style={styles.memoryBanner}>
                <ArcadeIcon name="eye-outline" size={38} color={accent} />
                <Text style={[styles.memoryTitle, { color: accent }]}>ЗАПОМНИ</Text>
                <Text style={styles.memoryText}>Найди {config.count}, затем числа перемешаются</Text>
                <GameButton label="ГОТОВ" accent={accent} onPress={activate} />
              </Animated.View>
            ) : null}
          </Panel>
          <View style={styles.mistakeRow}>
            {Array.from({ length: 3 }, (_, index) => <View key={index} style={[styles.mistakeDot, index < mistakes && styles.mistakeUsed]} />)}
            <Text style={styles.mistakeText}>ОШИБОК {mistakes}/3</Text>
          </View>
        </View>
      ) : null}

      {phase === "result" ? (
        <ResultCard
          icon={won ? elapsed < 60000 ? "trophy-outline" : "party-popper" : "lightning-bolt"}
          title={won ? elapsed < 60000 ? "ЛЕГЕНДА" : "ОТЛИЧНО" : "ПОПРОБУЙ СНОВА"}
          score={score}
          coins={coins}
          accent={accent}
          stats={[{ label: "ВРЕМЯ", value: won ? `${(elapsed / 1000).toFixed(1)}с` : "FAIL" }, { label: "ТОЧНОСТЬ", value: `${accuracy}%` }, { label: "ОШИБКИ", value: mistakes }]}
          onReplay={begin}
          onExit={onExit}
        />
      ) : null}
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  difficultyRow: { width: "100%", flexDirection: "row", gap: 7 },
  difficulty: { flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: B_COLORS.panelSoft, borderWidth: 1, borderColor: B_COLORS.border, alignItems: "center", justifyContent: "center" },
  difficultyActive: { backgroundColor: "rgba(255,216,90,.1)", borderColor: "rgba(255,216,90,.55)" },
  difficultyLabel: { color: B_COLORS.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  difficultyCount: { color: B_COLORS.ink, fontSize: 16, fontWeight: "900" },
  play: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center", gap: 8 },
  metrics: { flexDirection: "row", gap: 6 },
  progressInfo: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: B_COLORS.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  arena: { flex: 1, minHeight: 400, padding: 6, alignItems: "center", justifyContent: "center" },
  ballGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignContent: "center" },
  ball: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.16)", shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  ballPressed: { transform: [{ scale: 0.88 }] },
  ballText: { fontWeight: "900" },
  memoryBanner: { position: "absolute", width: "84%", maxWidth: 320, alignItems: "center", gap: 9, padding: 18, borderRadius: 22, backgroundColor: "rgba(8,9,18,.96)", borderWidth: 1, borderColor: "rgba(255,216,90,.28)" },
  memoryTitle: { color: B_COLORS.gold, fontSize: 25, fontWeight: "900", letterSpacing: 3 },
  memoryText: { color: B_COLORS.muted, textAlign: "center", fontSize: 12, lineHeight: 17 },
  mistakeRow: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  mistakeDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: "rgba(255,255,255,.18)" },
  mistakeUsed: { backgroundColor: B_COLORS.red, borderColor: B_COLORS.red },
  mistakeText: { color: B_COLORS.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
});
