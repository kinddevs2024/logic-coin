import {
  DIRECTIONS,
  effectiveMask,
  getRotatedMask,
  neighborIndex,
  oppositeDirection,
  uniqueRotations,
  validateLoopBoard,
} from "./engine";
import type { DirectionMask, LoopBoard, Rotation } from "./types";

function candidatesFor(board: LoopBoard, index: number): Rotation[] {
  return uniqueRotations(board.tiles[index]!.baseMask).filter((rotation) => {
    const mask = getRotatedMask(board.tiles[index]!.baseMask, rotation);
    return DIRECTIONS.every((direction) => neighborIndex(board, index, direction) >= 0 || !(mask & direction));
  });
}

function compatible(
  board: LoopBoard,
  index: number,
  rotation: Rotation,
  direction: DirectionMask,
  neighborRotation: Rotation,
) {
  const neighbor = neighborIndex(board, index, direction);
  if (neighbor < 0) return !(getRotatedMask(board.tiles[index]!.baseMask, rotation) & direction);
  const here = Boolean(getRotatedMask(board.tiles[index]!.baseMask, rotation) & direction);
  const there = Boolean(
    getRotatedMask(board.tiles[neighbor]!.baseMask, neighborRotation) & oppositeDirection(direction),
  );
  return here === there;
}

function solveInternal(board: LoopBoard, limit: number) {
  const domains = board.tiles.map((_tile, index) => candidatesFor(board, index));
  const assigned: (Rotation | undefined)[] = new Array(board.tiles.length);
  const solutions: Rotation[][] = [];

  function viable(index: number, rotation: Rotation) {
    return DIRECTIONS.every((direction) => {
      const neighbor = neighborIndex(board, index, direction);
      if (neighbor < 0) return compatible(board, index, rotation, direction, 0);
      const fixed = assigned[neighbor];
      if (fixed !== undefined) return compatible(board, index, rotation, direction, fixed);
      return domains[neighbor]!.some((candidate) => compatible(board, index, rotation, direction, candidate));
    });
  }

  function search() {
    if (solutions.length >= limit) return;
    let bestIndex = -1;
    let bestDomain: Rotation[] = [];
    for (let index = 0; index < assigned.length; index += 1) {
      if (assigned[index] !== undefined) continue;
      const domain = domains[index]!.filter((rotation) => viable(index, rotation));
      if (!domain.length) return;
      if (bestIndex < 0 || domain.length < bestDomain.length) {
        bestIndex = index;
        bestDomain = domain;
      }
    }
    if (bestIndex < 0) {
      const solved: LoopBoard = {
        ...board,
        tiles: board.tiles.map((tile, index) => ({ ...tile, rotation: assigned[index]! })),
      };
      if (validateLoopBoard(solved)) solutions.push(assigned.map((rotation) => rotation ?? 0));
      return;
    }
    for (const rotation of bestDomain) {
      assigned[bestIndex] = rotation;
      search();
      assigned[bestIndex] = undefined;
      if (solutions.length >= limit) return;
    }
  }

  search();
  return solutions;
}

export function solveLoopBoard(board: LoopBoard) {
  const solutions = solveInternal(board, 1);
  const rotations = solutions[0];
  return {
    solvable: Boolean(rotations),
    rotations: rotations ?? [],
    solutionBoard: rotations
      ? { ...board, tiles: board.tiles.map((tile, index) => ({ ...tile, rotation: rotations[index]! })) }
      : null,
  };
}

export function countSolutions(board: LoopBoard, limit = 2) {
  return solveInternal(board, limit).length;
}

export function getHint(board: LoopBoard) {
  const solved = solveLoopBoard(board);
  if (!solved.solvable) return null;
  const index = board.tiles.findIndex((tile, tileIndex) => effectiveMask(tile) !== effectiveMask(solved.solutionBoard!.tiles[tileIndex]!));
  if (index < 0) return null;
  return {
    row: Math.floor(index / board.cols),
    col: index % board.cols,
    index,
    suggestedRotation: solved.rotations[index]!,
  };
}

export const findPossibleRotations = uniqueRotations;
