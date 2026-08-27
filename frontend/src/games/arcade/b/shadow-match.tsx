import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { ArcadeIcon, type ArcadeIconName, SHADOW_ICON_POOL } from "./icons";
import type { ArcadeGameProps } from "./types";
import { arcadeSkinAccent, B_COLORS, CoinPill, errorTap, GameScreen, Metric, Panel, ProgressTrack, ResultCard, StartCard, successTap } from "./ui";
import { rewardCoins, shuffle, shuffleAvoidingFirst } from "./utils";
import { usePauseClock } from "@/games/pause-clock";

type ShadowStats = { score: number; lives: number; combo: number; maxCombo: number; correct: number; wrong: number; round: number };
type ShadowPhase = { start: number; count: number; duration: number; label: string; color: string };

const TOTAL_SECONDS = 80;
const REVEAL_MS = 900;
const PHASES: ShadowPhase[] = [
  { start: 0, count: 1, duration: 8000, label: "ФАЗА 1 · 1 СИМВОЛ", color: B_COLORS.green },
  { start: 30, count: 2, duration: 9000, label: "ФАЗА 2 · 2 СИМВОЛА", color: B_COLORS.gold },
  { start: 60, count: 3, duration: 10000, label: "ФАЗА 3 · 3 СИМВОЛА", color: B_COLORS.red },
];

function phaseFor(elapsedSeconds: number): ShadowPhase {
  return [...PHASES].reverse().find((phase) => elapsedSeconds >= phase.start) ?? PHASES[0];
}

function initialStats(): ShadowStats {
  return { score: 0, lives: 3, combo: 0, maxCombo: 0, correct: 0, wrong: 0, round: 0 };
}

export function ShadowMatchGame({ onExit, onFinish, initialBest = 0, initialCoins = 0, extraTimeSeconds = 0, paused = false, skin }: ArcadeGameProps) {
  const accent = arcadeSkinAccent(skin, B_COLORS.green);
  const { width } = useWindowDimensions();
  const sessionDuration = TOTAL_SECONDS + Math.max(0, extraTimeSeconds);
  const [screen, setScreen] = useState<"menu" | "play" | "result">("menu");
  const [stats, setStats] = useState<ShadowStats>(() => initialStats());
  const [targets, setTargets] = useState<ArcadeIconName[]>([]);
  const [display, setDisplay] = useState<ArcadeIconName[]>([]);
  const [found, setFound] = useState<Set<ArcadeIconName>>(new Set());
  const [revealing, setRevealing] = useState(false);
  const [locked, setLocked] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [roundLeft, setRoundLeft] = useState(1);
  const startedAt = useRef(0);
  const roundStartedAt = useRef(0);
  const roundDeadline = useRef(0);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsRef = useRef(stats);
  const reported = useRef(false);
  usePauseClock(paused, [startedAt, roundStartedAt, roundDeadline]);
  const lastTarget = useRef<ArcadeIconName | undefined>(undefined);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const finish = useCallback((finalStats: ShadowStats) => {
    if (reported.current) return;
    reported.current = true;
    if (revealTimer.current) clearTimeout(revealTimer.current);
    const accuracy = Math.round(finalStats.correct / Math.max(1, finalStats.correct + finalStats.wrong) * 100);
    const won = accuracy >= 65;
    setStats(finalStats);
    setScreen("result");
    onFinish?.({
      gameId: "shadow-match",
      score: finalStats.score,
      coins: rewardCoins(finalStats.score, won),
      won,
      durationMs: Date.now() - startedAt.current,
      details: { accuracy, combo: finalStats.maxCombo, rounds: finalStats.round },
    });
  }, [onFinish]);

  const nextRound = useCallback(() => {
    if (reported.current) return;
    const nextStats = { ...statsRef.current, round: statsRef.current.round + 1 };
    statsRef.current = nextStats;
    setStats(nextStats);
    const currentPhase = phaseFor((Date.now() - startedAt.current) / 1000);
    const pool = shuffleAvoidingFirst(SHADOW_ICON_POOL, lastTarget.current).slice(0, 36);
    lastTarget.current = pool[0];
    setTargets(pool.slice(0, currentPhase.count));
    setDisplay(shuffle(pool));
    setFound(new Set());
    setLocked(false);
    setRevealing(true);
    setRoundLeft(1);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      setRevealing(false);
      roundStartedAt.current = Date.now();
      roundDeadline.current = Date.now() + currentPhase.duration;
      setRoundLeft(1);
    }, REVEAL_MS);
  }, []);

  const begin = useCallback(() => {
    const next = initialStats();
    setStats(next);
    statsRef.current = next;
    setElapsed(0);
    setTargets([]);
    setDisplay([]);
    setFound(new Set());
    setLocked(false);
    setRevealing(false);
    reported.current = false;
    lastTarget.current = undefined;
    startedAt.current = Date.now();
    setScreen("play");
    setTimeout(nextRound, 0);
  }, [nextRound]);

  const failRound = useCallback(() => {
    if (locked || revealing || screen !== "play") return;
    setLocked(true);
    const current = statsRef.current;
    const next = { ...current, combo: 0, wrong: current.wrong + 1, lives: current.lives - 1 };
    statsRef.current = next;
    setStats(next);
    errorTap();
    if (next.lives <= 0) setTimeout(() => finish(next), 500);
    else setTimeout(nextRound, 700);
  }, [finish, locked, nextRound, revealing, screen]);

  useEffect(() => {
    if (screen !== "play" || paused) return;
    const interval = setInterval(() => {
      const seconds = (Date.now() - startedAt.current) / 1000;
      setElapsed(seconds);
      if (seconds >= sessionDuration) {
        clearInterval(interval);
        finish(statsRef.current);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [finish, paused, screen, sessionDuration]);

  useEffect(() => {
    if (screen !== "play" || revealing || locked || roundDeadline.current <= 0 || paused) return;
    const interval = setInterval(() => {
      const phase = phaseFor((Date.now() - startedAt.current) / 1000);
      const fraction = Math.max(0, (roundDeadline.current - Date.now()) / phase.duration);
      setRoundLeft(fraction);
      if (fraction <= 0) {
        clearInterval(interval);
        failRound();
      }
    }, 75);
    return () => clearInterval(interval);
  }, [failRound, locked, paused, revealing, screen]);

  useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);

  const pick = useCallback((iconName: ArcadeIconName) => {
    if (revealing || locked || found.has(iconName)) return;
    if (!targets.includes(iconName)) {
      failRound();
      return;
    }
    const nextFound = new Set(found);
    nextFound.add(iconName);
    setFound(nextFound);
    successTap();
    if (targets.every((target) => nextFound.has(target))) {
      setLocked(true);
      const current = statsRef.current;
      const nextCombo = current.combo + 1;
      const phase = phaseFor(elapsed);
      const speedBonus = Math.round(Math.max(0, 1 - (Date.now() - roundStartedAt.current) / phase.duration) * 30);
      const points = 10 * targets.length + speedBonus + Math.max(0, nextCombo - 1) * 7;
      const next = { ...current, score: current.score + points, combo: nextCombo, maxCombo: Math.max(current.maxCombo, nextCombo), correct: current.correct + 1 };
      statsRef.current = next;
      setStats(next);
      setTimeout(nextRound, 360);
    }
  }, [elapsed, failRound, found, locked, nextRound, revealing, targets]);

  const phase = phaseFor(elapsed);
  const boardWidth = Math.min(430, width - 34);
  const gap = 4;
  const cellSize = (boardWidth - gap * 5) / 6;
  const accuracy = Math.round(stats.correct / Math.max(1, stats.correct + stats.wrong) * 100);
  const coins = rewardCoins(stats.score, accuracy >= 65);
  const best = Math.max(initialBest, stats.score);
  const rank = accuracy >= 95 ? "ТЕЛЕПАТ" : accuracy >= 80 ? "МОЛНИЯ" : accuracy >= 65 ? "РЕФЛЕКС" : accuracy >= 50 ? "СТРЕЛОК" : "НОВИЧОК";
  const foundCount = useMemo(() => found.size, [found]);

  return (
    <GameScreen title="ТЕНЬ" accent={accent} skin={skin} onExit={onExit} right={<CoinPill value={initialCoins + coins} />}>
      {screen === "menu" ? <StartCard icon="eye-outline" title="ТЕНЬ" subtitle="Найди · быстро · точно" accent={accent} details={["Запомни символ за 0.9 секунды", "Найди его среди 36 карточек", "После 30 и 60 секунд целей станет больше"]} onStart={begin} /> : null}
      {screen === "play" ? (
        <View style={styles.play}>
          <View style={styles.metrics}>
            <Metric label="COIN" value={rewardCoins(stats.score, accuracy >= 65)} color={accent} />
            <Metric label="СЕРИЯ" value={`×${stats.combo}`} color={B_COLORS.gold} />
            <Metric label="ЖИЗНИ" value={`${stats.lives}/3`} color={B_COLORS.red} />
          </View>
          <ProgressTrack value={1 - elapsed / sessionDuration} color={phase.color} />
          <ProgressTrack value={revealing ? 1 : roundLeft} color={roundLeft < 0.2 ? B_COLORS.red : phase.color} />
          <View style={styles.targetZone}>
            <Text style={styles.targetLabel}>{revealing ? "ЗАПОМНИ" : "НАЙДИ"}</Text>
            <View style={styles.targets}>
              {targets.map((target) => (
                <View key={target} style={[styles.targetBox, { borderColor: `${phase.color}66` }, found.has(target) && styles.targetFound, found.has(target) && { borderColor: accent }]}>
                  <ArcadeIcon name={revealing || found.has(target) ? target : "help-circle-outline"} size={32} color={revealing || found.has(target) ? accent : "rgba(78,242,163,.38)"} />
                </View>
              ))}
            </View>
            <Text style={[styles.phase, { color: phase.color }]}>{phase.label} · РАУНД {stats.round}</Text>
          </View>
          <Panel style={styles.boardPanel}>
            <View style={[styles.board, { width: boardWidth, gap }]}>
              {display.map((iconName, index) => (
                <Animated.View key={`${stats.round}-${iconName}`} entering={ZoomIn.delay(index * 7).duration(180)}>
                  <Pressable disabled={revealing || locked} onPress={() => pick(iconName)} style={({ pressed }) => [styles.cell, { width: cellSize, height: cellSize }, found.has(iconName) && styles.cellFound, found.has(iconName) && { borderColor: accent }, pressed && styles.cellPressed]}>
                    <ArcadeIcon name={iconName} size={Math.min(29, cellSize * 0.46)} color={found.has(iconName) ? accent : B_COLORS.ink} />
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </Panel>
          <Text style={styles.foundText}>{revealing ? "СМОТРИ ВНИМАТЕЛЬНО" : `НАЙДЕНО ${foundCount}/${targets.length}`}</Text>
        </View>
      ) : null}
      {screen === "result" ? (
        <Animated.View entering={FadeIn} style={StyleSheet.absoluteFill}>
          <ResultCard icon={accuracy >= 80 ? "eye-outline" : "target"} title={rank} score={stats.score} coins={coins} accent={accent} stats={[{ label: "ТОЧНОСТЬ", value: `${accuracy}%` }, { label: "СЕРИЯ", value: stats.maxCombo }, { label: "BEST", value: best }]} onReplay={begin} onExit={onExit} />
        </Animated.View>
      ) : null}
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  play: { flex: 1, width: "100%", maxWidth: 460, alignSelf: "center", gap: 6 },
  metrics: { flexDirection: "row", gap: 5 },
  targetZone: { alignItems: "center", gap: 5, minHeight: 112, justifyContent: "center" },
  targetLabel: { color: B_COLORS.muted, fontSize: 9, fontWeight: "900", letterSpacing: 3 },
  targets: { flexDirection: "row", gap: 7 },
  targetBox: { width: 58, height: 58, borderRadius: 15, borderWidth: 1.2, backgroundColor: "rgba(78,242,163,.045)", alignItems: "center", justifyContent: "center" },
  targetFound: { backgroundColor: "rgba(78,242,163,.16)", borderColor: B_COLORS.green },
  phase: { fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
  boardPanel: { flex: 1, minHeight: 390, padding: 7, alignItems: "center", justifyContent: "center" },
  board: { flexDirection: "row", flexWrap: "wrap" },
  cell: { borderRadius: 9, borderWidth: 1, borderColor: "rgba(255,255,255,.07)", backgroundColor: "rgba(255,255,255,.035)", alignItems: "center", justifyContent: "center" },
  cellPressed: { transform: [{ scale: 0.86 }] },
  cellFound: { borderColor: B_COLORS.green, backgroundColor: "rgba(78,242,163,.16)" },
  foundText: { color: B_COLORS.muted, textAlign: "center", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
});
