export type LongcatCell = 0 | 1 | 2;
export type LongcatDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";
export type LongcatPoint = { row: number; col: number };

export type LongcatLevel = {
  id: number;
  title: string;
  grid: LongcatCell[][];
  start: LongcatPoint;
  attempts: number;
  difficulty: "easy" | "medium" | "hard";
  stage: number;
};

export type LongcatState = {
  head: LongcatPoint;
  body: LongcatPoint[];
};
