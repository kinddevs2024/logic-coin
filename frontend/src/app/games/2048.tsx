import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { AppText } from "@/components/app-text";
import { GameShell } from "@/components/game-shell";
import {
  PIXEL_ARENA_CHROME,
  PIXEL_GAME_COLORS,
  PixelActionButton,
  PixelArena,
  PixelIconButton,
  PixelStat,
} from "@/components/pixel-game-ui";
import { EMPTY_GAME_PROGRESS, useGameProgressStore } from "@/games/progress-store";
import { gameCoinReward } from "@/games/rewards";

type Direction = "left" | "right" | "up" | "down";
type Grid = number[][];

const tileColors: Record<number, string> = {
  2: "#FFF1E6", 4: "#FFE1CF", 8: "#FFD079", 16: "#FFC43D",
  32: "#FFE500", 64: "#F5B51B", 128: "#E87559", 256: "#D75A43",
  512: "#C84E3C", 1024: "#B73328", 2048: "#38394A",
};

function initialGrid(): Grid {
  return [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 4]];
}

function slideLine(line: number[]): { line: number[]; gained: number } {
  const values = line.filter(Boolean);
  const merged: number[] = [];
  let gained = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === values[index + 1]) {
      const value = values[index]! * 2;
      merged.push(value);
      gained += value;
      index += 1;
    } else merged.push(values[index]!);
  }
  while (merged.length < 4) merged.push(0);
  return { line: merged, gained };
}

function transpose(grid: Grid): Grid {
  return grid[0]!.map((_, col) => grid.map((row) => row[col] ?? 0));
}

function moveGrid(grid: Grid, direction: Direction) {
  const vertical = direction === "up" || direction === "down";
  const reverse = direction === "right" || direction === "down";
  const source = vertical ? transpose(grid) : grid.map((row) => [...row]);
  let gained = 0;
  const moved = source.map((row) => {
    const prepared = reverse ? [...row].reverse() : [...row];
    const result = slideLine(prepared);
    gained += result.gained;
    return reverse ? result.line.reverse() : result.line;
  });
  const next = vertical ? transpose(moved) : moved;
  const changed = JSON.stringify(next) !== JSON.stringify(grid);
  return { next, changed, gained };
}

function spawn(grid: Grid): Grid {
  const empty: { row: number; col: number }[] = [];
  grid.forEach((row, rowIndex) => row.forEach((value, colIndex) => {
    if (!value) empty.push({ row: rowIndex, col: colIndex });
  }));
  if (!empty.length) return grid;
  const target = empty[Math.floor(Math.random() * empty.length)]!;
  const next = grid.map((row) => [...row]);
  next[target.row]![target.col] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function canContinue(grid: Grid): boolean {
  if (grid.some((row) => row.some((value) => value === 0))) return true;
  return (["left", "right", "up", "down"] as Direction[]).some(
    (direction) => moveGrid(grid, direction).changed,
  );
}

function GameControl({
  direction,
  icon,
  onMove,
}: {
  direction: Direction;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onMove: (direction: Direction) => void;
}) {
  return <PixelIconButton icon={icon} label={{ left: "Влево", right: "Вправо", up: "Вверх", down: "Вниз" }[direction]} onPress={() => onMove(direction)} size={52} />;
}

export default function MergeScreen() {
  const progress = useGameProgressStore((state) => state.games["2048"]) ?? EMPTY_GAME_PROGRESS;
  const recordScore = useGameProgressStore((state) => state.recordScore);
  const { width } = useWindowDimensions();
  const [grid, setGrid] = useState<Grid>(() => initialGrid());
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [history, setHistory] = useState<{ grid: Grid; score: number }[]>([]);
  const recorded = useRef(false);
  const viewportWidth = width > 0 ? width : 390;
  const boardSize = Math.min(480, viewportWidth - 60);
  const gap = 8;
  const tile = Math.floor((boardSize - gap * 5) / 4);
  const maxTile = Math.max(...grid.flat());
  const level = Math.max(1, Math.floor(Math.log2(Math.max(128, maxTile))) - 6);
  const nextGoal = 2 ** (level + 7);

  const move = useCallback((direction: Direction) => {
    const result = moveGrid(grid, direction);
    if (!result.changed) return;
    setHistory((items) => [...items.slice(-9), { grid: grid.map((row) => [...row]), score }]);
    const next = spawn(result.next);
    setGrid(next);
    setScore(score + result.gained);
    setOver(!canContinue(next));
  }, [grid, score]);

  useEffect(() => {
    if (!over || recorded.current) return;
    recorded.current = true;
    recordScore("2048", score, `Плитка ${maxTile}`);
  }, [maxTile, over, recordScore, score]);

  const gesture = useMemo(
    () => Gesture.Pan().minDistance(18).onEnd((event) => {
      "worklet";
      const horizontal = Math.abs(event.translationX) > Math.abs(event.translationY);
      const direction: Direction = horizontal
        ? event.translationX > 0 ? "right" : "left"
        : event.translationY > 0 ? "down" : "up";
      runOnJS(move)(direction);
    }),
    [move],
  );

  const restart = () => {
    if (score > 0 && !recorded.current) recordScore("2048", score, `Плитка ${maxTile}`);
    setGrid(initialGrid());
    setScore(0);
    setOver(false);
    setHistory([]);
    recorded.current = false;
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous || over) return;
    setGrid(previous.grid.map((row) => [...row]));
    setScore(previous.score);
    setHistory((items) => items.slice(0, -1));
  };

  return (
    <GameShell title="2048" gameId="2048" meta={<AppText style={styles.metaScore}>{gameCoinReward(score)} coin</AppText>}>
      <View style={styles.layout}>
        <View style={styles.stats}>
          <PixelStat label="Рекорд" value={Math.max(progress.bestScore, score)} />
          <PixelStat label="Прошлый" value={progress.previousScore} />
          <PixelStat label="Уровень" value={level} />
          <PixelStat label="Цель" value={nextGoal} />
        </View>
        <GestureDetector gesture={gesture}>
          <PixelArena
            style={{ width: tile * 4 + gap * 5 + PIXEL_ARENA_CHROME, height: tile * 4 + gap * 5 + PIXEL_ARENA_CHROME }}
            contentStyle={[styles.board, { padding: gap, gap }]}
          >
            {grid.map((row, rowIndex) => (
              <View key={rowIndex} style={[styles.row, { gap }]}>
                {row.map((value, colIndex) => (
                  <View
                    key={`${rowIndex}-${colIndex}`}
                    style={[
                      styles.tile,
                      {
                        width: tile,
                        height: tile,
                        backgroundColor: value
                          ? tileColors[value] ?? "#101E4B"
                          : "rgba(183,51,40,0.16)",
                      },
                    ]}
                  >
                    {value ? (
                      <AppText
                        color={value >= 128 ? "#FFFFFF" : PIXEL_GAME_COLORS.ink}
                        style={{ fontSize: value >= 1024 ? 20 : value >= 128 ? 24 : 29, lineHeight: 34, fontWeight: "800" }}
                      >
                        {value}
                      </AppText>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
            {over ? (
              <View style={styles.overlay}>
                <AppText variant="heading" color="#FFFFFF">Игра окончена</AppText>
                <PixelActionButton label="Ещё раз" icon="refresh" onPress={restart} />
              </View>
            ) : null}
          </PixelArena>
        </GestureDetector>
        <View style={styles.controls}>
          <GameControl onMove={move} direction="left" icon="arrow-back" />
          <GameControl onMove={move} direction="up" icon="arrow-up" />
          <GameControl onMove={move} direction="down" icon="arrow-down" />
          <GameControl onMove={move} direction="right" icon="arrow-forward" />
        </View>
        <View style={styles.bottomActions}>
          <PixelActionButton disabled={!history.length || over} onPress={undo} icon="arrow-undo" label="Отменить ход" />
          <PixelActionButton onPress={restart} icon="refresh" label="Новая игра" />
        </View>
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  layout: { alignItems: "center", gap: 18 },
  stats: { width: "100%", maxWidth: 520, flexDirection: "row", gap: 7 },
  metaScore: { color: PIXEL_GAME_COLORS.ink, fontWeight: "900", fontSize: 15 },
  board: {},
  row: { flexDirection: "row" },
  tile: { borderRadius: 3, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,249,241,0.42)" },
  overlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(183,51,40,0.94)",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  controls: { flexDirection: "row", gap: 8 },
  bottomActions: { flexDirection: "row", alignItems: "center", gap: 8 },
});
