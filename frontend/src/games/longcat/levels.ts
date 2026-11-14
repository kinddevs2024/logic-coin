import type { LongcatCell, LongcatLevel } from "./types";

type SnakeLevelOptions = {
  id: number;
  width: number;
  lanes: number;
  vertical?: boolean;
  reverse?: boolean;
};

function makeSnakeLevel({
  id,
  width,
  lanes,
  vertical = false,
  reverse = false,
}: SnakeLevelOptions): LongcatLevel {
  const height = lanes * 2 - 1;
  let grid: LongcatCell[][] = Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, col) => {
      if (row % 2 === 0) return 1;
      const lane = Math.floor(row / 2);
      const connector = lane % 2 === 0 ? width - 1 : 0;
      if (col === connector) return 1;
      return col % 3 === (id + row) % 3 ? 2 : 0;
    }),
  );
  let start = { row: 0, col: 0 };
  if (reverse) {
    grid = grid.map((row) => [...row].reverse());
    start = { row: 0, col: width - 1 };
  }
  if (vertical) {
    grid = grid[0]!.map((_, col) => grid.map((row) => row[col]!));
    start = { row: start.col, col: start.row };
  }
  return {
    id,
    title: id <= 5 ? `Маршрут ${id}` : id <= 10 ? `Поворот ${id}` : `Лабиринт ${id}`,
    grid,
    start,
    attempts: 3,
    difficulty: id <= 6 ? "easy" : id <= 14 ? "medium" : "hard",
    stage: Math.ceil(id / 10),
  };
}

const LEVEL_CONFIGS: Omit<SnakeLevelOptions, "id">[] = [
  { width: 4, lanes: 2 },
  { width: 5, lanes: 2, reverse: true },
  { width: 4, lanes: 3 },
  { width: 5, lanes: 3, vertical: true },
  { width: 6, lanes: 3, reverse: true },
  { width: 5, lanes: 4 },
  { width: 6, lanes: 4, vertical: true },
  { width: 7, lanes: 3, reverse: true },
  { width: 7, lanes: 4 },
  { width: 8, lanes: 4, vertical: true, reverse: true },
  { width: 6, lanes: 5 },
  { width: 7, lanes: 5, reverse: true },
  { width: 8, lanes: 4, vertical: true },
  { width: 8, lanes: 5 },
  { width: 9, lanes: 4, reverse: true },
  { width: 7, lanes: 6, vertical: true },
  { width: 8, lanes: 6 },
  { width: 9, lanes: 5, vertical: true, reverse: true },
  { width: 9, lanes: 6 },
  { width: 10, lanes: 6, vertical: true },
];

export const LONGCAT_LEVELS: LongcatLevel[] = LEVEL_CONFIGS.map((config, index) =>
  makeSnakeLevel({ ...config, id: index + 1 }),
);

export function getLongcatLevel(id: number): LongcatLevel {
  return LONGCAT_LEVELS[Math.max(0, Math.min(LONGCAT_LEVELS.length - 1, id - 1))]!;
}
