import { EAST, NORTH, SOUTH, WEST, type DirectionMask, type LoopLevel, type Rotation } from "./types";
import { oppositeDirection, validateLoopBoard } from "./engine";

type GenerateOptions = {
  width: number;
  height: number;
  complexity: number;
  branchiness: number;
  density: number;
  seed: number;
};

function randomSource(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const STEPS: [number, number, DirectionMask][] = [
  [-1, 0, NORTH],
  [0, 1, EAST],
  [1, 0, SOUTH],
  [0, -1, WEST],
];

export function generateLoopLevel(options: GenerateOptions, id = 1): LoopLevel {
  const random = randomSource(options.seed);
  const count = options.width * options.height;
  const masks = new Array<number>(count).fill(0);
  const visited = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const current = stack[stack.length - 1]!;
    const row = Math.floor(current / options.width);
    const col = current % options.width;
    const choices = STEPS
      .map(([dr, dc, direction]) => ({ row: row + dr, col: col + dc, direction }))
      .filter(({ row: nextRow, col: nextCol }) => nextRow >= 0 && nextRow < options.height && nextCol >= 0 && nextCol < options.width)
      .map((choice) => ({ ...choice, index: choice.row * options.width + choice.col }))
      .filter((choice) => !visited.has(choice.index));
    if (!choices.length) {
      stack.pop();
      continue;
    }
    const next = choices[Math.floor(random() * choices.length)]!;
    masks[current] |= next.direction;
    masks[next.index] |= oppositeDirection(next.direction);
    visited.add(next.index);
    stack.push(next.index);
  }

  const extraChance = Math.min(0.3, Math.max(0, options.density * 0.18 + options.branchiness * 0.08));
  for (let row = 0; row < options.height; row += 1) {
    for (let col = 0; col < options.width; col += 1) {
      const index = row * options.width + col;
      for (const [dr, dc, direction] of STEPS.slice(0, 2)) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextCol < 0 || nextRow >= options.height || nextCol >= options.width || random() > extraChance) continue;
        const nextIndex = nextRow * options.width + nextCol;
        masks[index] |= direction;
        masks[nextIndex] |= oppositeDirection(direction);
      }
    }
  }

  const tiles = masks.map((baseMask, index) => ({
    baseMask,
    rotation: ((Math.floor(random() * 4) + index + options.complexity) % 4) as Rotation,
  }));
  const board = { rows: options.height, cols: options.width, tiles, requireSingleNetwork: true };
  if (validateLoopBoard(board) && tiles.length > 1) tiles[0]!.rotation = ((tiles[0]!.rotation + 1) % 4) as Rotation;
  return {
    id,
    stage: Math.ceil(id / 10),
    rows: options.height,
    cols: options.width,
    title: id <= 5 ? ["Первый поворот", "Уголки", "Прямые линии", "Связка", "Мягкая петля"][id - 1]! : `Сеть ${id}`,
    tiles,
    solvedMasks: masks,
    requireSingleNetwork: true,
  };
}

export function validateGeneratedLevel(level: LoopLevel) {
  return validateLoopBoard({
    rows: level.rows,
    cols: level.cols,
    requireSingleNetwork: level.requireSingleNetwork,
    tiles: level.solvedMasks.map((baseMask) => ({ baseMask, rotation: 0 })),
  });
}
