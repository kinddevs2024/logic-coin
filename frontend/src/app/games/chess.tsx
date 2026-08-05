import { useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import { AppText } from "@/components/app-text";
import { GameShell } from "@/components/game-shell";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";

type Color = "w" | "b";
type Kind = "k" | "q" | "r" | "b" | "n" | "p";
type Piece = `${Color}${Kind}`;
type Board = (Piece | null)[][];
type Square = { row: number; col: number };

const symbols: Record<Piece, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
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
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const [board, setBoard] = useState<Board>(() => initialBoard());
  const [selected, setSelected] = useState<Square | null>(null);
  const [turn, setTurn] = useState<Color>("w");
  const [winner, setWinner] = useState<Color | null>(null);
  const viewportWidth = width > 0 ? width : 390;
  const boardSize = Math.min(520, viewportWidth - 32);
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
    const next = board.map((line) => [...line]);
    const moving = next[selected.row]![selected.col]!;
    const captured = next[row]![col];
    next[selected.row]![selected.col] = null;
    const promotion = moving[1] === "p" && (row === 0 || row === 7);
    next[row]![col] = promotion ? (`${moving[0]}q` as Piece) : moving;
    setBoard(next);
    setSelected(null);
    if (captured?.[1] === "k") setWinner(turn);
    else setTurn((value) => (value === "w" ? "b" : "w"));
  };

  const restart = () => {
    setBoard(initialBoard());
    setSelected(null);
    setTurn("w");
    setWinner(null);
  };

  return (
    <GameShell
      title="Шахматы"
      meta={<AppText variant="caption" muted>{winner ? `${winner === "w" ? "Белые" : "Чёрные"} выиграли` : turn === "w" ? "Ход белых" : "Ход чёрных"}</AppText>}
    >
      <View style={styles.layout}>
        <GlassSurface variant="strong" intensity={54} style={[styles.board, { width: cell * 8 + 8 }]}>
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
                          ? String(theme.primary)
                          : (rowIndex + colIndex) % 2 === 0
                            ? theme.mode === "dark" ? "#C8D0DA" : "#EDF2F7"
                            : theme.mode === "dark" ? "#617086" : "#8CA0B8",
                        borderColor: isLegal ? String(theme.primary) : "transparent",
                        borderWidth: isLegal ? 3 : 0,
                      },
                    ]}
                  >
                    {piece ? (
                      <AppText
                        style={[styles.piece, { fontSize: cell * 0.7, lineHeight: cell * 0.78 }]}
                        color={piece[0] === "w" ? "#FFFFFF" : "#101820"}
                      >
                        {symbols[piece]}
                      </AppText>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </GlassSurface>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Новая партия"
          onPress={restart}
          style={({ pressed }) => [styles.restart, pressed && styles.pressed]}
        >
          <AppText variant="label" color={String(theme.primary)}>Новая партия</AppText>
        </Pressable>
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  layout: { alignItems: "center", gap: 16 },
  board: { padding: 4, borderRadius: 22 },
  row: { flexDirection: "row" },
  square: { alignItems: "center", justifyContent: "center" },
  piece: { fontWeight: "400", textShadowColor: "rgba(0,0,0,0.24)", textShadowRadius: 1 },
  restart: { minHeight: 46, paddingHorizontal: 20, justifyContent: "center", borderRadius: 999 },
  pressed: { opacity: 0.65 },
});
