import {
  applyLongcatMove,
  createLongcatState,
  isLongcatComplete,
  pointKey,
  validLongcatMoves,
} from "./engine";
import type { LongcatDirection, LongcatLevel, LongcatState } from "./types";

export type LongcatSolution = {
  solvable: boolean;
  minimumMoves: number | null;
  solution: LongcatDirection[];
};

function stateKey(state: LongcatState): string {
  return `${pointKey(state.head)}|${state.body.map(pointKey).sort().join(",")}`;
}

export function solveLongcatLevel(level: LongcatLevel): LongcatSolution {
  const start = createLongcatState(level);
  const queue: { state: LongcatState; path: LongcatDirection[] }[] = [
    { state: start, path: [] },
  ];
  const visited = new Set([stateKey(start)]);
  while (queue.length) {
    const current = queue.shift()!;
    if (isLongcatComplete(level, current.state)) {
      return {
        solvable: true,
        minimumMoves: current.path.length,
        solution: current.path,
      };
    }
    for (const direction of validLongcatMoves(level, current.state)) {
      const next = applyLongcatMove(level, current.state, direction);
      const key = stateKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ state: next, path: [...current.path, direction] });
    }
  }
  return { solvable: false, minimumMoves: null, solution: [] };
}
