import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { AppText } from "@/components/app-text";
import { GameShell } from "@/components/game-shell";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";

const ROWS = 18;
const COLS = 10;
const colors = ["transparent", "#27C1E6", "#F6C344", "#7C5CFC", "#41C979", "#FF6B6B", "#3D7CFF", "#FF9F43"];
const shapes = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
] as const;

type Matrix = number[][];
type Piece = { shape: Matrix; x: number; y: number; color: number };

function emptyBoard(): Matrix {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as number[]);
}

function createPiece(index = Math.floor(Math.random() * shapes.length)): Piece {
  const shape = shapes[index]!.map((row) => [...row]);
  return { shape, x: Math.floor((COLS - shape[0]!.length) / 2), y: 0, color: index + 1 };
}

function collides(board: Matrix, piece: Piece): boolean {
  return piece.shape.some((row, rowIndex) =>
    row.some((value, columnIndex) => {
      if (!value) return false;
      const x = piece.x + columnIndex;
      const y = piece.y + rowIndex;
      return x < 0 || x >= COLS || y >= ROWS || (y >= 0 && Boolean(board[y]?.[x]));
    }),
  );
}

function rotateShape(shape: Matrix): Matrix {
  return shape[0]!.map((_, index) => shape.map((row) => row[index] ?? 0).reverse());
}

function GameControl({
  icon,
  onPress,
  color,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  color: string;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.controlPress, pressed && styles.pressed]}
    >
      <GlassSurface variant="strong" intensity={48} style={styles.control}>
        <Ionicons name={icon} size={24} color={color} />
      </GlassSurface>
    </Pressable>
  );
}

export default function TetrisScreen() {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const [board, setBoard] = useState<Matrix>(() => emptyBoard());
  const [active, setActive] = useState<Piece>(() => createPiece(0));
  const [score, setScore] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const viewportWidth = width > 0 ? width : 390;
  const boardWidth = Math.min(340, viewportWidth - 40);
  const cell = Math.floor(boardWidth / COLS);

  const display = useMemo(() => {
    const next = board.map((row) => [...row]);
    active.shape.forEach((row, rowIndex) =>
      row.forEach((value, columnIndex) => {
        const y = active.y + rowIndex;
        const x = active.x + columnIndex;
        if (value && y >= 0 && y < ROWS && x >= 0 && x < COLS) next[y]![x] = active.color;
      }),
    );
    return next;
  }, [active, board]);

  const lock = useCallback((piece: Piece) => {
    setBoard((current) => {
      const merged = current.map((row) => [...row]);
      piece.shape.forEach((row, rowIndex) =>
        row.forEach((value, columnIndex) => {
          if (value && piece.y + rowIndex >= 0) {
            merged[piece.y + rowIndex]![piece.x + columnIndex] = piece.color;
          }
        }),
      );
      const remaining = merged.filter((row) => row.some((value) => value === 0));
      const cleared = ROWS - remaining.length;
      if (cleared) setScore((value) => value + [0, 100, 300, 500, 800][cleared]!);
      return [...Array.from({ length: cleared }, () => Array(COLS).fill(0) as number[]), ...remaining];
    });
    const nextPiece = createPiece();
    setActive(nextPiece);
    setBoard((current) => {
      if (collides(current, nextPiece)) setOver(true);
      return current;
    });
  }, []);

  const stepDown = useCallback(() => {
    if (paused || over) return;
    const next = { ...active, y: active.y + 1 };
    if (collides(board, next)) lock(active);
    else setActive(next);
  }, [active, board, lock, over, paused]);

  useEffect(() => {
    const interval = setInterval(stepDown, Math.max(230, 700 - Math.floor(score / 500) * 55));
    return () => clearInterval(interval);
  }, [score, stepDown]);

  const move = (dx: number) => {
    const next = { ...active, x: active.x + dx };
    if (!collides(board, next) && !over) setActive(next);
  };
  const rotate = () => {
    const next = { ...active, shape: rotateShape(active.shape) };
    if (!collides(board, next) && !over) setActive(next);
  };
  const hardDrop = () => {
    if (over) return;
    let next = { ...active };
    while (!collides(board, { ...next, y: next.y + 1 })) next = { ...next, y: next.y + 1 };
    lock(next);
  };
  const restart = () => {
    setBoard(emptyBoard());
    setActive(createPiece(0));
    setScore(0);
    setPaused(false);
    setOver(false);
  };

  return (
    <GameShell title="Тетрис" meta={<AppText variant="label">{score}</AppText>}>
      <View style={styles.layout}>
        <GlassSurface variant="strong" intensity={58} style={[styles.board, { width: cell * COLS + 12 }]}>
          {display.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((value, columnIndex) => (
                <View
                  key={`${rowIndex}-${columnIndex}`}
                  style={[
                    styles.cell,
                    {
                      width: cell,
                      height: cell,
                      backgroundColor: value ? colors[value] : theme.mode === "dark" ? "rgba(255,255,255,0.035)" : "rgba(13,27,53,0.035)",
                      borderColor: value ? "rgba(255,255,255,0.34)" : "rgba(127,148,176,0.08)",
                    },
                  ]}
                />
              ))}
            </View>
          ))}
          {over ? (
            <View style={styles.overlay}>
              <AppText variant="heading" color="#FFFFFF">Игра окончена</AppText>
              <Pressable onPress={restart} style={styles.restart}><AppText variant="label" color="#FFFFFF">Ещё раз</AppText></Pressable>
            </View>
          ) : null}
        </GlassSurface>
        <View style={styles.controls}>
          <GameControl label="Влево" color={String(theme.text)} icon="arrow-back" onPress={() => move(-1)} />
          <GameControl label="Повернуть" color={String(theme.text)} icon="refresh" onPress={rotate} />
          <GameControl label="Вниз" color={String(theme.text)} icon="arrow-down" onPress={stepDown} />
          <GameControl label="Вправо" color={String(theme.text)} icon="arrow-forward" onPress={() => move(1)} />
          <GameControl label="Сбросить" color={String(theme.text)} icon="chevron-collapse" onPress={hardDrop} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => setPaused((value) => !value)} style={styles.pause}>
          <AppText variant="caption" muted>{paused ? "Продолжить" : "Пауза"}</AppText>
        </Pressable>
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  layout: { alignItems: "center", gap: 16 },
  board: { padding: 6, borderRadius: 24, alignSelf: "center" },
  row: { flexDirection: "row" },
  cell: { borderWidth: 0.5, borderRadius: 4 },
  overlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(3,8,16,0.82)",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  restart: { backgroundColor: "#0A84FF", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  controls: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  controlPress: { width: 54, height: 54, borderRadius: 27 },
  control: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  pause: { minHeight: 44, justifyContent: "center", paddingHorizontal: 20 },
});
