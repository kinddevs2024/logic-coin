import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { ArcadeIcon } from "./icons";
import type { ArcadeGameProps } from "./types";
import { arcadeSkinAccent, B_COLORS, CoinPill, errorTap, GameButton, GameScreen, Metric, Panel, ProgressTrack, StartCard, successTap } from "./ui";
import { mulberry32, rewardCoins } from "./utils";

type Cell = { charge: number; color: number } | null;
type LevelData = { moves: number; grid: Cell[] };
type PulseStatus = "playing" | "won" | "lost";

const COLS = 6;
const ROWS = 6;
const TOTAL = COLS * ROWS;
const EXPLODE_AT = 4;
const COLORS = ["#FF4777", "#FF9D45", "#2EE8FF", "#A879FF"];

const TUTORIALS: LevelData[] = [
  { moves: 5, grid: Array.from({ length: TOTAL }, (_, index) => ({ 7: { charge: 2, color: 0 }, 8: { charge: 3, color: 0 }, 9: { charge: 2, color: 1 }, 14: { charge: 3, color: 1 }, 15: { charge: 2, color: 0 }, 20: { charge: 1, color: 2 }, 21: { charge: 2, color: 2 }, 22: { charge: 3, color: 1 }, 27: { charge: 2, color: 0 }, 28: { charge: 1, color: 2 } }[index] ?? null)) },
  { moves: 6, grid: Array.from({ length: TOTAL }, (_, index) => ({ 0: { charge: 2, color: 0 }, 1: { charge: 3, color: 1 }, 2: { charge: 2, color: 0 }, 6: { charge: 1, color: 2 }, 7: { charge: 3, color: 0 }, 8: { charge: 2, color: 1 }, 12: { charge: 3, color: 1 }, 13: { charge: 2, color: 2 }, 14: { charge: 1, color: 0 }, 18: { charge: 2, color: 1 }, 19: { charge: 3, color: 2 }, 20: { charge: 2, color: 0 } }[index] ?? null)) },
];

function neighbors(index: number): number[] {
  const row = Math.floor(index / COLS);
  const column = index % COLS;
  const result: number[] = [];
  if (row > 0) result.push(index - COLS);
  if (row < ROWS - 1) result.push(index + COLS);
  if (column > 0) result.push(index - 1);
  if (column < COLS - 1) result.push(index + 1);
  return result;
}

function cloneGrid(grid: Cell[]): Cell[] {
  return grid.map((cell) => cell ? { ...cell } : null);
}

function buildLevel(level: number): LevelData {
  if (level < TUTORIALS.length) return { moves: TUTORIALS[level].moves, grid: cloneGrid(TUTORIALS[level].grid) };
  const random = mulberry32((level + 1) * 2654435761);
  const depth = level - TUTORIALS.length + 1;
  const colorCount = depth <= 3 ? 2 : depth <= 7 ? 3 : 4;
  const targetCount = Math.min(TOTAL, 8 + depth * 2);
  const grid: Cell[] = Array(TOTAL).fill(null);
  const chosen = new Set<number>();
  let cursor = (1 + Math.floor(random() * 4)) * COLS + 1 + Math.floor(random() * 4);
  chosen.add(cursor);
  while (chosen.size < targetCount) {
    const options = neighbors(cursor).filter((index) => !chosen.has(index));
    if (options.length === 0) {
      const allFrontier = [...chosen].flatMap(neighbors).filter((index) => !chosen.has(index));
      cursor = allFrontier[Math.floor(random() * allFrontier.length)] ?? Math.floor(random() * TOTAL);
    } else {
      cursor = options[Math.floor(random() * options.length)];
    }
    chosen.add(cursor);
  }
  chosen.forEach((index) => { grid[index] = { charge: 1 + Math.floor(random() * 3), color: Math.floor(random() * colorCount) }; });
  const guaranteedRoute = pulseSolutionLength(grid);
  return { moves: Math.max(5, guaranteedRoute + 1), grid };
}

function simulate(source: Cell[], index: number) {
  const grid = cloneGrid(source);
  const touched = [index, ...neighbors(index)];
  touched.forEach((cellIndex) => { if (grid[cellIndex]) grid[cellIndex] = { ...grid[cellIndex]!, charge: grid[cellIndex]!.charge + 1 }; });
  let queue = touched.filter((cellIndex) => grid[cellIndex] && grid[cellIndex]!.charge >= EXPLODE_AT);
  const exploded = new Set<number>();
  let chainLength = 0;
  while (queue.length > 0) {
    const next: number[] = [];
    queue.forEach((cellIndex) => {
      const cell = grid[cellIndex];
      if (!cell || cell.charge < EXPLODE_AT || exploded.has(cellIndex)) return;
      exploded.add(cellIndex);
      grid[cellIndex] = null;
      neighbors(cellIndex).forEach((neighbor) => {
        if (!grid[neighbor]) return;
        grid[neighbor] = { ...grid[neighbor]!, charge: grid[neighbor]!.charge + 1 };
        if (grid[neighbor]!.charge >= EXPLODE_AT && !exploded.has(neighbor)) next.push(neighbor);
      });
    });
    queue = next;
    chainLength += 1;
  }
  return { grid, exploded, chainLength };
}

function pulseSolutionLength(source: Cell[]): number {
  let grid = cloneGrid(source);
  let moves = 0;
  while (grid.some(Boolean) && moves < TOTAL * 4) {
    let best: ReturnType<typeof simulate> | null = null;
    let bestWeight = -1;
    for (let index = 0; index < grid.length; index += 1) {
      if (!grid[index]) continue;
      const outcome = simulate(grid, index);
      const remainingCharge = outcome.grid.reduce((sum, nextCell) => sum + (nextCell?.charge ?? 0), 0);
      const weight = outcome.exploded.size * 10_000 + outcome.chainLength * 1_000 + remainingCharge;
      if (weight > bestWeight) {
        bestWeight = weight;
        best = outcome;
      }
    }
    if (!best) break;
    grid = best.grid;
    moves += 1;
  }
  return moves;
}

export function PulseGame({ onExit, onFinish, initialCoins = 0, skin }: ArcadeGameProps) {
  const { width } = useWindowDimensions();
  const accent = arcadeSkinAccent(skin, B_COLORS.violet);
  const cellColors = useMemo(
    () => skin && skin.id !== "classic" ? [skin.primary, COLORS[1], skin.secondary, COLORS[3]] : COLORS,
    [skin],
  );
  const [screen, setScreen] = useState<"menu" | "play">("menu");
  const [level, setLevel] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [grid, setGrid] = useState<Cell[]>(() => buildLevel(0).grid);
  const [snapshot, setSnapshot] = useState<LevelData>(() => buildLevel(0));
  const [moves, setMoves] = useState(5);
  const [levelScore, setLevelScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [chainMax, setChainMax] = useState(0);
  const [status, setStatus] = useState<PulseStatus>("playing");
  const [burst, setBurst] = useState<Set<number>>(new Set());
  const [lastLevelPoints, setLastLevelPoints] = useState(0);
  const startedAt = useRef(0);

  const alive = useMemo(() => grid.reduce((sum, cell) => sum + (cell ? 1 : 0), 0), [grid]);

  const beginLevel = useCallback((nextLevel: number, nextTotal = totalScore) => {
    const data = buildLevel(nextLevel);
    setLevel(nextLevel);
    setAttempt(1);
    setGrid(cloneGrid(data.grid));
    setSnapshot({ moves: data.moves, grid: cloneGrid(data.grid) });
    setMoves(data.moves);
    setLevelScore(0);
    setTotalScore(nextTotal);
    setChainMax(0);
    setStatus("playing");
    setBurst(new Set());
    startedAt.current = Date.now();
  }, [totalScore]);

  const start = useCallback(() => {
    setScreen("play");
    beginLevel(0, 0);
  }, [beginLevel]);

  const restart = useCallback(() => {
    setGrid(cloneGrid(snapshot.grid));
    setMoves(snapshot.moves);
    setAttempt((value) => value + 1);
    setLevelScore(0);
    setChainMax(0);
    setStatus("playing");
    setBurst(new Set());
    startedAt.current = Date.now();
  }, [snapshot]);

  const pressCell = useCallback((index: number) => {
    if (status !== "playing" || !grid[index]) return;
    const result = simulate(grid, index);
    const points = result.exploded.size * 10 * Math.max(1, result.chainLength);
    const nextLevelScore = levelScore + points;
    const nextMoves = moves - 1;
    const nextChainMax = Math.max(chainMax, result.chainLength);
    setGrid(result.grid);
    setMoves(nextMoves);
    setLevelScore(nextLevelScore);
    setChainMax(nextChainMax);
    setBurst(result.exploded);
    setTimeout(() => setBurst(new Set()), 260);
    if (result.exploded.size > 0) successTap();

    const remaining = result.grid.reduce((sum, cell) => sum + (cell ? 1 : 0), 0);
    if (remaining === 0) {
      const multiplier = attempt === 1 ? 1 : attempt === 2 ? 0.7 : 0.5;
      const bonus = Math.max(0, nextMoves) * 50;
      const earned = Math.round((nextLevelScore + bonus) * multiplier);
      const finalTotal = totalScore + earned;
      setLastLevelPoints(earned);
      setTotalScore(finalTotal);
      setStatus("won");
      onFinish?.({ gameId: "pulse", score: earned, coins: rewardCoins(earned), won: true, durationMs: Date.now() - startedAt.current, details: { level: level + 1, attempt, chain: nextChainMax } });
    } else if (nextMoves <= 0) {
      setStatus("lost");
      errorTap();
      onFinish?.({ gameId: "pulse", score: nextLevelScore, coins: rewardCoins(nextLevelScore, false), won: false, durationMs: Date.now() - startedAt.current, details: { level: level + 1, remaining } });
    }
  }, [attempt, chainMax, grid, level, levelScore, moves, onFinish, status, totalScore]);

  const boardWidth = Math.min(390, width - 42);
  const gap = 5;
  const cellSize = (boardWidth - gap * (COLS - 1)) / COLS;
  const displayedCoins = initialCoins + rewardCoins(totalScore + levelScore, status === "won");

  return (
    <GameScreen title="PULSE" accent={accent} skin={skin} onExit={onExit} right={<CoinPill value={displayedCoins} />}>
      {screen === "menu" ? <StartCard icon="access-point" title="PULSE" subtitle="Цепная реакция" accent={accent} details={["Тап заряжает клетку и соседей", "Четыре заряда запускают взрыв", "Очисти поле за лимит ходов"]} onStart={start} /> : null}
      {screen === "play" ? (
        <View style={styles.play}>
          <View style={styles.metrics}>
            <Metric label="УРОВЕНЬ" value={level + 1} color={accent} />
            <Metric label="ПОПЫТКА" value={attempt} color={attempt === 1 ? B_COLORS.green : B_COLORS.gold} />
            <Metric label="ЯЧЕЙКИ" value={alive} color={B_COLORS.cyan} />
            <Metric label="COIN" value={rewardCoins(totalScore + levelScore)} color={B_COLORS.gold} />
          </View>
          <View style={styles.movesRow}><Text style={styles.movesLabel}>ОСТАЛОСЬ ХОДОВ</Text><Text style={[styles.movesValue, moves <= 2 && { color: B_COLORS.red }]}>{moves}</Text></View>
          <ProgressTrack value={moves / Math.max(1, snapshot.moves)} color={moves <= 2 ? B_COLORS.red : accent} />
          <Text style={styles.chain}>{chainMax >= 2 ? `ЛУЧШАЯ ЦЕПЬ ×${chainMax}` : "4 ЗАРЯДА = ВЗРЫВ"}</Text>
          <Panel style={styles.boardPanel}>
            <View style={[styles.board, { width: boardWidth }]}>
              {grid.map((cell, index) => (
                <Pressable key={index} disabled={!cell || status !== "playing"} onPress={() => pressCell(index)} style={[styles.cell, { width: cellSize, height: cellSize }, cell ? { borderColor: `${cellColors[cell.color]}88`, backgroundColor: `${cellColors[cell.color]}22` } : null]}>
                  {cell ? (
                    <Animated.View entering={ZoomIn.duration(150)} style={[styles.charge, burst.has(index) && styles.exploding]}>
                      {Array.from({ length: Math.min(3, cell.charge) }, (_, dot) => <View key={dot} style={[styles.dot, { backgroundColor: cellColors[cell.color], shadowColor: cellColors[cell.color] }]} />)}
                    </Animated.View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Panel>
          <GameButton label="ЗАНОВО" accent={accent} secondary onPress={restart} />
        </View>
      ) : null}

      {status === "won" && screen === "play" ? (
        <Animated.View entering={FadeIn} style={styles.overlay}>
          <Panel style={styles.overlayCard}>
            <ArcadeIcon name="check-decagram-outline" size={52} color={accent} />
            <Text style={[styles.overlayTitle, { color: accent }]}>ОЧИЩЕНО!</Text>
            <Text style={styles.overlayScore}>{lastLevelPoints}</Text>
            <View style={styles.metrics}><Metric label="ЦЕПЬ" value={`×${chainMax}`} color="#FF9D45" /><Metric label="ПОПЫТКА" value={attempt} color={accent} /><Metric label="COIN" value={`+${rewardCoins(lastLevelPoints)}`} color={B_COLORS.gold} /></View>
            <GameButton label="СЛЕДУЮЩИЙ" accent={accent} onPress={() => beginLevel(level + 1, totalScore)} />
            <GameButton label="ПОВТОРИТЬ" accent={accent} secondary onPress={restart} />
          </Panel>
        </Animated.View>
      ) : null}

      {status === "lost" && screen === "play" ? (
        <Animated.View entering={FadeIn} style={styles.overlay}>
          <Panel style={styles.overlayCard}>
            <ArcadeIcon name="close-octagon-outline" size={52} color={B_COLORS.red} />
            <Text style={[styles.overlayTitle, { color: B_COLORS.red }]}>НЕТ ХОДОВ</Text>
            <Text style={styles.overlayCaption}>ОСТАЛОСЬ {alive} ЯЧЕЕК</Text>
            <GameButton label="ЕЩЁ РАЗ" accent={B_COLORS.red} onPress={restart} />
            <GameButton label="ВЫЙТИ" accent={B_COLORS.red} secondary onPress={() => onExit?.()} />
          </Panel>
        </Animated.View>
      ) : null}
    </GameScreen>
  );
}

const styles = StyleSheet.create({
  play: { flex: 1, width: "100%", maxWidth: 430, alignSelf: "center", justifyContent: "center", gap: 9 },
  metrics: { width: "100%", flexDirection: "row", gap: 5 },
  movesRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  movesLabel: { color: B_COLORS.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  movesValue: { color: B_COLORS.ink, fontSize: 13, fontWeight: "900" },
  chain: { minHeight: 18, color: "#FF9D45", textAlign: "center", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  boardPanel: { alignItems: "center", padding: 8 },
  board: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  cell: { borderRadius: 8, borderWidth: 1.4, borderColor: "rgba(255,255,255,.05)", backgroundColor: "rgba(255,255,255,.02)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  charge: { width: "64%", height: "64%", flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 4 },
  exploding: { transform: [{ scale: 1.35 }], opacity: 0.2 },
  dot: { width: 9, height: 9, borderRadius: 5, shadowOpacity: 0.8, shadowRadius: 6 },
  overlay: { ...StyleSheet.absoluteFill, zIndex: 100, backgroundColor: "rgba(4,5,13,.92)", justifyContent: "center", alignItems: "center", padding: 18 },
  overlayCard: { width: "100%", maxWidth: 390, alignItems: "center", gap: 13, padding: 25 },
  overlayTitle: { fontSize: 30, fontWeight: "900", letterSpacing: 3 },
  overlayScore: { color: B_COLORS.gold, fontSize: 48, fontWeight: "900" },
  overlayCaption: { color: B_COLORS.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
});
