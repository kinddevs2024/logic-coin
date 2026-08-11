import { describe, expect, it } from "vitest";

import {
  applyLongcatMove,
  createLongcatState,
  isLongcatComplete,
  isLongcatStuck,
  traceLongcatMove,
} from "../src/games/longcat/engine";
import { LONGCAT_LEVELS } from "../src/games/longcat/levels";
import { solveLongcatLevel } from "../src/games/longcat/solver";
import type { LongcatLevel } from "../src/games/longcat/types";
import {
  entityInsideHolePercent,
  evaluateVortexCollision,
  grownHoleRadius,
  requiredEntityCount,
} from "../src/games/gobble/engine";
import { VORTEX_LEVELS } from "../src/games/gobble/levels";
import type { VortexEntity } from "../src/games/gobble/types";
import {
  EAST,
  NORTH,
  SOUTH,
  WEST,
  type LoopBoard,
} from "../src/games/loops/types";
import {
  getRotatedMask,
  rotateMaskClockwise,
  rotateTile,
  validateLoopBoard,
} from "../src/games/loops/engine";
import { LOOP_LEVELS } from "../src/games/loops/levels";
import { getHint, solveLoopBoard } from "../src/games/loops/solver";
import {
  applyPuzzleEvent,
  createPuzzleState,
  normalizedToPixels,
  resetPuzzle,
  validatePuzzleDefinition,
} from "../src/games/brain-tricks/engine";
import { BRAIN_TRICKS_LEVELS } from "../src/games/brain-tricks/levels";

describe("longcat engine", () => {
  it("fills every crossed cell and stops at walls or its body", () => {
    const level: LongcatLevel = {
      id: 1,
      title: "test",
      grid: [[1, 1, 1], [1, 1, 1]],
      start: { row: 0, col: 0 },
      attempts: 3,
      difficulty: "easy",
      stage: 1,
    };
    const start = createLongcatState(level);
    expect(traceLongcatMove(level, start, "RIGHT")).toEqual([
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]);
    const right = applyLongcatMove(level, start, "RIGHT");
    const down = applyLongcatMove(level, right, "DOWN");
    const left = applyLongcatMove(level, down, "LEFT");
    expect(left.body).toHaveLength(6);
    expect(isLongcatComplete(level, left)).toBe(true);
    expect(traceLongcatMove(level, left, "UP")).toEqual([]);
  });

  it("detects a non-winning dead end", () => {
    const level: LongcatLevel = {
      id: 2,
      title: "dead end",
      grid: [[1, 1, 1], [0, 1, 0], [1, 1, 1]],
      start: { row: 0, col: 0 },
      attempts: 3,
      difficulty: "easy",
      stage: 1,
    };
    const state = applyLongcatMove(level, createLongcatState(level), "RIGHT");
    expect(isLongcatStuck(level, state)).toBe(true);
    expect(isLongcatComplete(level, state)).toBe(false);
  });

  it("ships 20 levels with solver-backed solutions", () => {
    expect(LONGCAT_LEVELS).toHaveLength(20);
    for (const level of LONGCAT_LEVELS) {
      const result = solveLongcatLevel(level);
      expect(result.solvable, `level ${level.id}`).toBe(true);
      expect(result.minimumMoves).toBeGreaterThan(0);
    }
  });
});

describe("vortex engine", () => {
  it("requires deep overlap for people and swallows only fitting objects", () => {
    const human: VortexEntity = {
      id: "human",
      kind: "human",
      position: { x: 0.5, y: 0.5 },
      radius: 0.04,
      mass: 2,
      edible: false,
      required: false,
    };
    const edible: VortexEntity = {
      ...human,
      id: "box",
      kind: "crate",
      edible: true,
      required: true,
      radius: 0.03,
    };
    expect(evaluateVortexCollision({ x: 0.4, y: 0.5, radius: 0.075 }, human)).toBe("NONE");
    expect(entityInsideHolePercent({ x: 0.5, y: 0.5, radius: 0.075 }, human)).toBeGreaterThan(0.68);
    expect(evaluateVortexCollision({ x: 0.5, y: 0.5, radius: 0.075 }, human)).toBe("HUMAN_FAIL");
    expect(evaluateVortexCollision({ x: 0.5, y: 0.5, radius: 0.075 }, edible)).toBe("SWALLOW");
    expect(evaluateVortexCollision({ x: 0.5, y: 0.5, radius: 0.03 }, edible)).toBe("NONE");
  });

  it("ships 30 levels and caps configurable hole growth", () => {
    expect(VORTEX_LEVELS).toHaveLength(30);
    for (const level of VORTEX_LEVELS) expect(requiredEntityCount(level)).toBeGreaterThanOrEqual(3);
    const growing = VORTEX_LEVELS.find((level) => level.hole.grow)!;
    expect(grownHoleRadius(growing, growing.hole.maxRadius, 20)).toBe(growing.hole.maxRadius);
  });
});

describe("loops engine", () => {
  it("rotates bitmasks clockwise and restores them after four turns", () => {
    expect(rotateMaskClockwise(NORTH)).toBe(EAST);
    expect(rotateMaskClockwise(EAST)).toBe(SOUTH);
    expect(rotateMaskClockwise(SOUTH)).toBe(WEST);
    expect(rotateMaskClockwise(WEST)).toBe(NORTH);
    expect(getRotatedMask(NORTH | SOUTH, 2)).toBe(NORTH | SOUTH);
    expect(getRotatedMask(15, 3)).toBe(15);
  });

  it("validates reciprocal connectors, borders, and multiple closed networks", () => {
    const solved: LoopBoard = {
      rows: 1,
      cols: 4,
      tiles: [
        { baseMask: EAST, rotation: 0 },
        { baseMask: WEST, rotation: 0 },
        { baseMask: EAST, rotation: 0 },
        { baseMask: WEST, rotation: 0 },
      ],
    };
    expect(validateLoopBoard(solved)).toBe(true);
    expect(validateLoopBoard({ ...solved, requireSingleNetwork: true })).toBe(false);
    expect(validateLoopBoard(rotateTile(solved, 0))).toBe(false);
  });

  it("ships 30 solvable generated levels and returns a solver-backed hint", () => {
    expect(LOOP_LEVELS).toHaveLength(30);
    const level = LOOP_LEVELS[0]!;
    const board = { rows: level.rows, cols: level.cols, tiles: level.tiles, requireSingleNetwork: true };
    const solved = solveLoopBoard(board);
    expect(solved.solvable).toBe(true);
    expect(solved.solutionBoard && validateLoopBoard(solved.solutionBoard)).toBe(true);
    expect(getHint(board)).not.toBeNull();
  });
});

describe("brain tricks engine", () => {
  it("ships and validates 40 original declarative puzzles", () => {
    expect(BRAIN_TRICKS_LEVELS).toHaveLength(40);
    for (const level of BRAIN_TRICKS_LEVELS) {
      const validation = validatePuzzleDefinition(level);
      expect(validation.valid, `level ${level.id}: ${validation.errors.join(", ")}`).toBe(true);
    }
  });

  it("handles correct taps once, ignores wrong answers safely, and resets immutably", () => {
    const level = BRAIN_TRICKS_LEVELS[3]!;
    const initial = createPuzzleState(level);
    const wrong = applyPuzzleEvent(level, initial, { type: "tap", actorId: "cloud" });
    expect(wrong.wrongActions).toBe(1);
    const solved = applyPuzzleEvent(level, wrong, { type: "tap", actorId: "moon" });
    expect(solved.completed).toBe(true);
    expect(applyPuzzleEvent(level, solved, { type: "tap", actorId: "moon" })).toEqual(solved);
    expect(resetPuzzle(level)).toEqual(initial);
  });

  it("supports valid drop chains and normalized responsive coordinates", () => {
    const level = BRAIN_TRICKS_LEVELS[10]!;
    const initial = createPuzzleState(level);
    const installed = applyPuzzleEvent(level, initial, { type: "drop", actorId: "part", targetId: "machine" });
    expect(installed.objectStates.machine).toBe("ready");
    const finished = applyPuzzleEvent(level, installed, { type: "tap", actorId: "machine" });
    expect(finished.completed).toBe(true);
    expect(normalizedToPixels({ x: 50, y: 25 }, 400, 800)).toEqual({ x: 200, y: 200 });
  });
});
