import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { AppText } from "@/components/app-text";
import { GameShell } from "@/components/game-shell";
import {
  PIXEL_ARENA_CHROME,
  PIXEL_GAME_COLORS,
  PixelActionButton,
  PixelArena,
  PixelStat,
} from "@/components/pixel-game-ui";
import { EMPTY_GAME_PROGRESS, useGameProgressStore } from "@/games/progress-store";

type Color = "w" | "b";
type Kind = "k" | "q" | "r" | "b" | "n" | "p";
type Piece = `${Color}${Kind}`;
type Board = (Piece | null)[][];
type Square = { row: number; col: number };

const pieceIcons: Record<Kind, React.ComponentProps<typeof MaterialCommunityIcons>["name"]> = {
  k: "chess-king",
  q: "chess-queen",
  r: "chess-rook",
  b: "chess-bishop",
  n: "chess-knight",
  p: "chess-pawn",
};

function initialBoard(): Board {
  const back: Kind[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  return [
    back.map((kind) => `b${kind}` as Piece),
    Array(8).fill("bp") as Piece[],
    ...Array.from({ length: 4 }, () => Array(8).fill(null) as null[]),
    Array(8).fill("wp") as Piece[],
    back.map((kind) => `w${kind}` as Piece),
  ];
}

function pathClear(board: Board, from: Square, to: Square): boolean {
  const rowStep = Math.sign(to.row - from.row);
  const colStep = Math.sign(to.col - from.col);
  let row = from.row + rowStep;
  let col = from.col + colStep;
  while (row !== to.row || col !== to.col) {
    if (board[row]?.[col]) return false;
    row += rowStep;
    col += colStep;
  }
  return true;
}

function canMove(board: Board, from: Square, to: Square): boolean {
  const piece = board[from.row]?.[from.col];
  if (!piece || (from.row === to.row && from.col === to.col)) return false;
  const target = board[to.row]?.[to.col];
  if (target?.[0] === piece[0]) return false;
  const color = piece[0] as Color;
  const kind = piece[1] as Kind;
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  const ar = Math.abs(dr);
  const ac = Math.abs(dc);
  if (kind === "n") return (ar === 2 && ac === 1) || (ar === 1 && ac === 2);
  if (kind === "k") return ar <= 1 && ac <= 1;
  if (kind === "r") return (dr === 0 || dc === 0) && pathClear(board, from, to);
  if (kind === "b") return ar === ac && pathClear(board, from, to);
  if (kind === "q") return (dr === 0 || dc === 0 || ar === ac) && pathClear(board, from, to);
  const direction = color === "w" ? -1 : 1;
  const startRow = color === "w" ? 6 : 1;
  if (dc === 0 && !target && dr === direction) return true;
  if (
    dc === 0 &&
    !target &&
    from.row === startRow &&
    dr === direction * 2 &&
    !board[from.row + direction]?.[from.col]
  ) return true;
  return ar === 1 && dr === direction && ac === 1 && Boolean(target);
}

export default function ChessScreen() {
  const progress = useGameProgressStore((state) => state.games.chess) ?? EMPTY_GAME_PROGRESS;
  const recordScore = useGameProgressStore((state) => state.recordScore);
  const { width } = useWindowDimensions();
  const [board, setBoard] = useState<Board>(() => initialBoard());
  const [selected, setSelected] = useState<Square | null>(null);
  const [turn, setTurn] = useState<Color>("w");
  const [winner, setWinner] = useState<Color | null>(null);
  const [moves, setMoves] = useState(0);
  const [captures, setCaptures] = useState(0);
  const [history, setHistory] = useState<{ board: Board; turn: Color; moves: number; captures: number }[]>([]);
  const recorded = useRef(false);
  const viewportWidth = width > 0 ? width : 390;
  const boardSize = Math.min(520, viewportWidth - 60);
  const cell = Math.floor(boardSize / 8);
  const legal = useMemo(() => {
    if (!selected) return new Set<string>();
    const result = new Set<string>();
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        if (canMove(board, selected, { row, col })) result.add(`${row}-${col}`);
      }
    }
    return result;
  }, [board, selected]);

  const tap = (row: number, col: number) => {
    if (winner) return;
    const piece = board[row]?.[col];
    if (!selected) {
      if (piece?.[0] === turn) setSelected({ row, col });
      return;
    }
    if (piece?.[0] === turn) {
      setSelected({ row, col });
      return;
    }
    const to = { row, col };
    if (!canMove(board, selected, to)) return;
    setHistory((items) => [...items, { board: board.map((line) => [...line]), turn, moves, captures }]);
    const next = board.map((line) => [...line]);
    const moving = next[selected.row]![selected.col]!;
    const captured = next[row]![col];
    next[selected.row]![selected.col] = null;
    const promotion = moving[1] === "p" && (row === 0 || row === 7);
    next[row]![col] = promotion ? (`${moving[0]}q` as Piece) : moving;
    setBoard(next);
    setSelected(null);
    setMoves((value) => value + 1);
    if (captured) setCaptures((value) => value + 1);
    if (captured?.[1] === "k") setWinner(turn);
    else setTurn((value) => (value === "w" ? "b" : "w"));
  };

  useEffect(() => {
    if (!winner || recorded.current) return;
    recorded.current = true;
    const points = Math.max(100, 1_000 - moves * 12 + captures * 25);
    recordScore("chess", points, winner === "w" ? "Победа белых" : "Победа чёрных", true);
  }, [captures, moves, recordScore, winner]);

  const restart = () => {
    setBoard(initialBoard());
    setSelected(null);
    setTurn("w");
    setWinner(null);
    setMoves(0);
    setCaptures(0);
    setHistory([]);
    recorded.current = false;
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setBoard(previous.board.map((line) => [...line]));
    setTurn(previous.turn);
    setMoves(previous.moves);
    setCaptures(previous.captures);
    setSelected(null);
    setWinner(null);
    setHistory((items) => items.slice(0, -1));
    recorded.current = false;
  };

  return (
    <GameShell
      gameId="chess"
      title="Шахматы"
      meta={<AppText style={styles.turnMeta}>{winner ? "Финиш" : turn === "w" ? "Белые" : "Чёрные"}</AppText>}
    >
      <View style={styles.layout}>
        <View style={styles.stats}>
          <PixelStat label="Рекорд" value={progress.bestScore} />
          <PixelStat label="Прошлый" value={progress.previousScore} />
          <PixelStat label="Ходы" value={moves} />
          <PixelStat label="Победы" value={progress.wins} />
        </View>
        <PixelArena
          style={{ width: cell * 8 + PIXEL_ARENA_CHROME, height: cell * 8 + PIXEL_ARENA_CHROME }}
          contentStyle={styles.board}
        >
          {board.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((piece, colIndex) => {
                const key = `${rowIndex}-${colIndex}`;
                const active = selected?.row === rowIndex && selected.col === colIndex;
                const isLegal = legal.has(key);
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`${piece ?? "пусто"}, ${key}`}
                    onPress={() => tap(rowIndex, colIndex)}
                    style={[
                      styles.square,
                      {
                        width: cell,
                        height: cell,
                        backgroundColor: active
                          ? PIXEL_GAME_COLORS.yellow
                          : (rowIndex + colIndex) % 2 === 0
                            ? PIXEL_GAME_COLORS.panelStrong
                            : PIXEL_GAME_COLORS.arena,
                        borderColor: isLegal ? PIXEL_GAME_COLORS.yellow : "transparent",
                        borderWidth: isLegal ? 3 : 0,
                      },
                    ]}
                  >
                    {piece ? (
                      <MaterialCommunityIcons
                        name={pieceIcons[piece[1] as Kind]}
                        size={cell * 0.68}
                        color={piece[0] === "w" ? PIXEL_GAME_COLORS.frame : PIXEL_GAME_COLORS.ink}
                        style={styles.piece}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </PixelArena>
        <View style={styles.actions}>
          <PixelActionButton disabled={!history.length} label="Отменить" icon="arrow-undo" onPress={undo} />
          <PixelActionButton label="Новая партия" icon="refresh" onPress={restart} />
        </View>
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  layout: { alignItems: "center", gap: 16 },
  stats: { width: "100%", maxWidth: 560, flexDirection: "row", gap: 7 },
  turnMeta: { color: PIXEL_GAME_COLORS.ink, fontSize: 11, lineHeight: 14, fontWeight: "900", textAlign: "center" },
  board: {},
  row: { flexDirection: "row" },
  square: { alignItems: "center", justifyContent: "center" },
  piece: { textShadowColor: "rgba(56,57,74,0.42)", textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
});
