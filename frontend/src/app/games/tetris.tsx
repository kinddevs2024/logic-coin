import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

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
import { shuffledIndexes } from "@/games/random";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

const ROWS = 18;
const COLS = 10;
const colors = [
  "transparent",
  "#FFE500",
  "#FFF4E5",
  "#B73328",
  "#FFCC72",
  "#8A5C52",
  "#F79570",
  "#38394A",
];
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
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  label: string;
}) {
  return <PixelIconButton icon={icon} label={label} onPress={onPress} size={52} />;
}

export default function TetrisScreen({ paused: hostPaused = false }: { paused?: boolean }) {
  const progress = useGameProgressStore((state) => state.games.tetris) ?? EMPTY_GAME_PROGRESS;
  const recordScore = useGameProgressStore((state) => state.recordScore);
  const { width, height, isTablet } = useResponsiveLayout();
  const [board, setBoard] = useState<Matrix>(() => emptyBoard());
  const [active, setActive] = useState<Piece>(() => createPiece(0));
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const recorded = useRef(false);
  const pieceBag = useRef<number[]>([]);
  const previousPiece = useRef(0);
  const level = Math.floor(lines / 10) + 1;
  const viewportWidth = width > 0 ? width : 390;
  const viewportHeight = height > 0 ? height : 760;
  const isWide = isTablet;
  const heightBoundWidth = Math.max(210, ((viewportHeight - 250) * COLS) / ROWS);
  const boardWidth = Math.min(340, viewportWidth - 64, isWide ? heightBoundWidth : 340);
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

  const drawNextPiece = useCallback(() => {
    if (!pieceBag.current.length) {
      pieceBag.current = shuffledIndexes(shapes.length, previousPiece.current);
    }
    const index = pieceBag.current.shift() ?? 0;
    previousPiece.current = index;
    return createPiece(index);
  }, []);

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
      if (cleared) {
        setScore((value) => value + [0, 100, 300, 500, 800][cleared]! * level);
        setLines((value) => value + cleared);
      }
      return [...Array.from({ length: cleared }, () => Array(COLS).fill(0) as number[]), ...remaining];
    });
    const nextPiece = drawNextPiece();
    setActive(nextPiece);
    setBoard((current) => {
      if (collides(current, nextPiece)) setOver(true);
      return current;
    });
  }, [drawNextPiece, level]);

  const stepDown = useCallback(() => {
    if (paused || hostPaused || over) return;
    const next = { ...active, y: active.y + 1 };
    if (collides(board, next)) lock(active);
    else setActive(next);
  }, [active, board, hostPaused, lock, over, paused]);

  useEffect(() => {
    const interval = setInterval(stepDown, Math.max(165, 720 - (level - 1) * 65));
    return () => clearInterval(interval);
  }, [level, stepDown]);

  useEffect(() => {
    if (!over || recorded.current) return;
    recorded.current = true;
    recordScore("tetris", score, `Уровень ${level}`);
  }, [level, over, recordScore, score]);

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
    pieceBag.current = [];
    previousPiece.current = 0;
    setActive(createPiece(0));
    setScore(0);
    setLines(0);
    setPaused(false);
    setOver(false);
    recorded.current = false;
  };

  return (
    <GameShell title="Тетрис" gameId="tetris" meta={<AppText style={styles.metaScore}>{gameCoinReward(score)} coin</AppText>}>
      <View style={styles.layout}>
        <View style={styles.stats}>
          <PixelStat label="Рекорд" value={Math.max(progress.bestScore, score)} />
          <PixelStat label="Прошлый" value={progress.previousScore} />
          <PixelStat label="Уровень" value={level} />
          <PixelStat label="Линии" value={lines} />
        </View>
        <View style={[styles.playArea, isWide && styles.playAreaWide]}>
          <PixelArena
            style={{ width: cell * COLS + PIXEL_ARENA_CHROME, height: cell * ROWS + PIXEL_ARENA_CHROME }}
            contentStyle={styles.board}
          >
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
                        backgroundColor: value ? colors[value] : "rgba(183,51,40,0.13)",
                        borderColor: value ? PIXEL_GAME_COLORS.frameWarm : "rgba(183,51,40,0.2)",
                      },
                    ]}
                  />
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
          <View style={[styles.controls, isWide && styles.controlsWide]}>
            <GameControl label="Влево" icon="arrow-back" onPress={() => move(-1)} />
            <GameControl label="Повернуть" icon="refresh" onPress={rotate} />
            <GameControl label="Вниз" icon="arrow-down" onPress={stepDown} />
            <GameControl label="Вправо" icon="arrow-forward" onPress={() => move(1)} />
            <GameControl label="Сбросить" icon="chevron-collapse" onPress={hardDrop} />
            <PixelIconButton
              label={paused ? "Продолжить" : "Пауза"}
              icon={paused ? "play" : "pause"}
              active={paused}
              onPress={() => setPaused((value) => !value)}
              size={52}
            />
          </View>
        </View>
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  layout: { alignItems: "center", gap: 16 },
  stats: { width: "100%", maxWidth: 520, flexDirection: "row", gap: 7 },
  metaScore: { color: PIXEL_GAME_COLORS.ink, fontWeight: "900", fontSize: 15 },
  playArea: { alignItems: "center", justifyContent: "center", gap: 12 },
  playAreaWide: { flexDirection: "row" },
  board: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row" },
  cell: { borderWidth: 1 },
  overlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(183,51,40,0.94)",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  controls: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  controlsWide: { width: 116, flexDirection: "row" },
});
