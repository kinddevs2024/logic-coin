import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { AppText } from "@/components/app-text";
import { GameShell } from "@/components/game-shell";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";

type Direction = "left" | "right" | "up" | "down";
type Grid = number[][];

const tileColors: Record<number, string> = {
  2: "#E9F3FF", 4: "#D6E9FF", 8: "#A8D1FF", 16: "#72B5FF",
  32: "#3C98FF", 64: "#0A7CFF", 128: "#7C5CFC", 256: "#6544E8",
  512: "#FF9F43", 1024: "#FF7A3D", 2048: "#FF4F6D",
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
  color,
  onMove,
}: {
  direction: Direction;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  onMove: (direction: Direction) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={{ left: "Влево", right: "Вправо", up: "Вверх", down: "Вниз" }[direction]}
      onPress={() => onMove(direction)}
      style={({ pressed }) => [styles.controlPress, pressed && styles.pressed]}
    >
      <GlassSurface variant="strong" intensity={46} style={styles.control}>
        <Ionicons name={icon} size={23} color={color} />
      </GlassSurface>
    </Pressable>
  );
}

export default function MergeScreen() {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const [grid, setGrid] = useState<Grid>(() => initialGrid());
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const viewportWidth = width > 0 ? width : 390;
  const boardSize = Math.min(480, viewportWidth - 32);
  const gap = 8;
  const tile = Math.floor((boardSize - gap * 5) / 4);

  const move = useCallback((direction: Direction) => {
    setGrid((current) => {
      const result = moveGrid(current, direction);
      if (!result.changed) return current;
      const next = spawn(result.next);
      setScore((value) => value + result.gained);
      setOver(!canContinue(next));
      return next;
    });
  }, []);

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
    setGrid(initialGrid());
    setScore(0);
    setOver(false);
  };

  return (
    <GameShell title="2048" meta={<AppText variant="label">{score}</AppText>}>
      <View style={styles.layout}>
        <GestureDetector gesture={gesture}>
          <GlassSurface
            variant="strong"
            intensity={58}
            style={[styles.board, { width: tile * 4 + gap * 5, padding: gap, gap }]}
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
                          : theme.mode === "dark" ? "rgba(255,255,255,0.055)" : "rgba(13,27,53,0.055)",
                      },
                    ]}
                  >
                    {value ? (
                      <AppText
                        color={value >= 8 ? "#FFFFFF" : "#17304E"}
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
                <Pressable onPress={restart} style={styles.restart}>
                  <AppText variant="label" color="#FFFFFF">Ещё раз</AppText>
                </Pressable>
              </View>
            ) : null}
          </GlassSurface>
        </GestureDetector>
        <View style={styles.controls}>
          <GameControl color={String(theme.text)} onMove={move} direction="left" icon="arrow-back" />
          <GameControl color={String(theme.text)} onMove={move} direction="up" icon="arrow-up" />
          <GameControl color={String(theme.text)} onMove={move} direction="down" icon="arrow-down" />
          <GameControl color={String(theme.text)} onMove={move} direction="right" icon="arrow-forward" />
        </View>
        <Pressable accessibilityRole="button" onPress={restart} style={styles.newGame}>
          <AppText variant="caption" muted>Новая игра</AppText>
        </Pressable>
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  layout: { alignItems: "center", gap: 18 },
  board: { borderRadius: 26 },
  row: { flexDirection: "row" },
  tile: { borderRadius: 16, alignItems: "center", justifyContent: "center" },
  overlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(3,8,16,0.82)",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  restart: { backgroundColor: "#0A84FF", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  controls: { flexDirection: "row", gap: 8 },
  controlPress: { width: 54, height: 54, borderRadius: 27 },
  control: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  newGame: { minHeight: 44, justifyContent: "center", paddingHorizontal: 20 },
});
