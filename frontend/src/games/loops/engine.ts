import {
  EAST,
  NORTH,
  SOUTH,
  WEST,
  type DirectionMask,
  type LoopBoard,
  type LoopTile,
  type Rotation,
} from "./types";

export const DIRECTIONS = [NORTH, EAST, SOUTH, WEST] as const;

export function oppositeDirection(direction: DirectionMask): DirectionMask {
  return ({ [NORTH]: SOUTH, [EAST]: WEST, [SOUTH]: NORTH, [WEST]: EAST } as const)[direction];
}

export function rotateMaskClockwise(mask: number): number {
  return ((mask << 1) & 15) | ((mask & WEST) ? NORTH : 0);
}

export function getRotatedMask(baseMask: number, rotation: number): number {
  let mask = baseMask & 15;
  for (let step = 0; step < ((rotation % 4) + 4) % 4; step += 1) mask = rotateMaskClockwise(mask);
  return mask;
}

export function effectiveMask(tile: LoopTile): number {
  return getRotatedMask(tile.baseMask, tile.rotation);
}

export function rotateTile(board: LoopBoard, index: number, delta = 1): LoopBoard {
  if (!board.tiles[index]) return board;
  return {
    ...board,
    tiles: board.tiles.map((tile, tileIndex) =>
      tileIndex === index
        ? { ...tile, rotation: ((tile.rotation + delta + 4) % 4) as Rotation }
        : tile,
    ),
  };
}

export function neighborIndex(board: Pick<LoopBoard, "rows" | "cols">, index: number, direction: DirectionMask) {
  const row = Math.floor(index / board.cols);
  const col = index % board.cols;
  if (direction === NORTH) return row > 0 ? index - board.cols : -1;
  if (direction === SOUTH) return row < board.rows - 1 ? index + board.cols : -1;
  if (direction === WEST) return col > 0 ? index - 1 : -1;
  return col < board.cols - 1 ? index + 1 : -1;
}

export function validateLoopBoard(board: LoopBoard): boolean {
  for (let index = 0; index < board.tiles.length; index += 1) {
    const mask = effectiveMask(board.tiles[index]!);
    for (const direction of DIRECTIONS) {
      const connected = Boolean(mask & direction);
      const neighbor = neighborIndex(board, index, direction);
      if (neighbor < 0) {
        if (connected) return false;
        continue;
      }
      const reciprocal = Boolean(effectiveMask(board.tiles[neighbor]!) & oppositeDirection(direction));
      if (connected !== reciprocal) return false;
    }
  }
  if (!board.requireSingleNetwork) return true;
  const start = board.tiles.findIndex((tile) => effectiveMask(tile) !== 0);
  if (start < 0) return true;
  const visited = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const index = queue.shift()!;
    const mask = effectiveMask(board.tiles[index]!);
    for (const direction of DIRECTIONS) {
      if (!(mask & direction)) continue;
      const next = neighborIndex(board, index, direction);
      if (next >= 0 && !visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return board.tiles.every((tile, index) => effectiveMask(tile) === 0 || visited.has(index));
}

export const isBoardSolved = validateLoopBoard;

export function uniqueRotations(baseMask: number): Rotation[] {
  const seen = new Set<number>();
  const rotations: Rotation[] = [];
  for (let rotation = 0; rotation < 4; rotation += 1) {
    const mask = getRotatedMask(baseMask, rotation);
    if (!seen.has(mask)) {
      seen.add(mask);
      rotations.push(rotation as Rotation);
    }
  }
  return rotations;
}

export function resetLoopBoard(initial: LoopBoard): LoopBoard {
  return { ...initial, tiles: initial.tiles.map((tile) => ({ ...tile })) };
}

