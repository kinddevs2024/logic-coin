import { generateLoopLevel } from "./generator";

export const LOOP_LEVELS = Array.from({ length: 30 }, (_unused, offset) => {
  const id = offset + 1;
  const size = id <= 2 ? 2 : id <= 5 ? 3 : id <= 10 ? 4 : id <= 15 ? 5 : id <= 23 ? 6 : 7;
  return generateLoopLevel(
    {
      width: size,
      height: size,
      complexity: Math.ceil(id / 4),
      branchiness: Math.min(1, id / 24),
      density: Math.min(1, id / 30),
      seed: 731 + id * 97,
    },
    id,
  );
});

export function getLoopLevel(id: number) {
  return LOOP_LEVELS[Math.max(0, Math.min(LOOP_LEVELS.length - 1, id - 1))]!;
}

