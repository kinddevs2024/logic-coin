import type {
  LongcatDirection,
  LongcatLevel,
  LongcatPoint,
  LongcatState,
} from "./types";

const DELTA: Record<LongcatDirection, LongcatPoint> = {
  UP: { row: -1, col: 0 },
  DOWN: { row: 1, col: 0 },
  LEFT: { row: 0, col: -1 },
  RIGHT: { row: 0, col: 1 },
};

export const LONGCAT_DIRECTIONS = Object.keys(DELTA) as LongcatDirection[];

export function pointKey(point: LongcatPoint): string {
  return `${point.row}:${point.col}`;
}

export function createLongcatState(level: LongcatLevel): LongcatState {
  if (level.grid[level.start.row]?.[level.start.col] !== 1) {
    throw new Error(`Level ${level.id} starts outside a playable cell`);
  }
  return { head: { ...level.start }, body: [{ ...level.start }] };
}

export function totalPlayableCells(level: LongcatLevel): number {
  return level.grid.reduce(
    (total, row) => total + row.filter((cell) => cell === 1).length,
    0,
  );
}

export function traceLongcatMove(
  level: LongcatLevel,
  state: LongcatState,
  direction: LongcatDirection,
): LongcatPoint[] {
  const delta = DELTA[direction];
  const occupied = new Set(state.body.map(pointKey));
  const traversed: LongcatPoint[] = [];
  let cursor = state.head;
  while (true) {
    const next = { row: cursor.row + delta.row, col: cursor.col + delta.col };
    if (level.grid[next.row]?.[next.col] !== 1 || occupied.has(pointKey(next))) break;
    traversed.push(next);
    occupied.add(pointKey(next));
    cursor = next;
  }
  return traversed;
}

export function applyLongcatMove(
  level: LongcatLevel,
  state: LongcatState,
  direction: LongcatDirection,
): LongcatState {
  const traversed = traceLongcatMove(level, state, direction);
  if (!traversed.length) return state;
  return {
    head: traversed[traversed.length - 1]!,
    body: [...state.body, ...traversed],
  };
}

export function validLongcatMoves(
  level: LongcatLevel,
  state: LongcatState,
): LongcatDirection[] {
  return LONGCAT_DIRECTIONS.filter(
    (direction) => traceLongcatMove(level, state, direction).length > 0,
  );
}

export function isLongcatComplete(level: LongcatLevel, state: LongcatState): boolean {
  return state.body.length === totalPlayableCells(level);
}

export function isLongcatStuck(level: LongcatLevel, state: LongcatState): boolean {
  return !isLongcatComplete(level, state) && validLongcatMoves(level, state).length === 0;
}
