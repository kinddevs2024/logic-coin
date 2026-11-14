export const NORTH = 1;
export const EAST = 2;
export const SOUTH = 4;
export const WEST = 8;

export type DirectionMask = 1 | 2 | 4 | 8;
export type Rotation = 0 | 1 | 2 | 3;

export type LoopTile = {
  baseMask: number;
  rotation: Rotation;
};

export type LoopBoard = {
  rows: number;
  cols: number;
  tiles: LoopTile[];
  requireSingleNetwork?: boolean;
};

export type LoopLevel = {
  id: number;
  stage: number;
  rows: number;
  cols: number;
  title: string;
  tiles: LoopTile[];
  solvedMasks: number[];
  requireSingleNetwork: boolean;
};

