export type PuzzleLayer = "BACKGROUND" | "SCENE_BACK" | "OBJECT" | "CHARACTER" | "FOREGROUND" | "FX" | "UI";

export type PuzzlePoint = { x: number; y: number };

export type PuzzleObjectDefinition = {
  id: string;
  symbol?: string;
  icon?: string;
  label?: string;
  position: PuzzlePoint;
  size: number;
  color: string;
  state?: string;
  visible?: boolean;
  draggable?: boolean;
  tappable?: boolean;
  isZone?: boolean;
  layer?: PuzzleLayer;
};

export type PuzzlePrerequisite = {
  objectId: string;
  state: string;
};

export type PuzzleEffect =
  | { type: "setState"; objectId: string; state: string }
  | { type: "show"; objectId: string }
  | { type: "hide"; objectId: string }
  | { type: "move"; objectId: string; position: PuzzlePoint };

export type PuzzleRule = {
  id: string;
  event: "tap" | "doubleTap" | "hold" | "drop" | "rotate";
  actorId: string;
  targetId?: string;
  prerequisites?: PuzzlePrerequisite[];
  effects: PuzzleEffect[];
  once?: boolean;
};

export type PuzzleCondition =
  | { type: "stateEquals"; objectId: string; state: string }
  | { type: "visibleEquals"; objectId: string; visible: boolean }
  | { type: "ruleTriggered"; ruleId: string };

export type PuzzleDefinition = {
  id: number;
  stage: number;
  title: string;
  instruction: string;
  background: string;
  objects: PuzzleObjectDefinition[];
  rules: PuzzleRule[];
  successConditions: PuzzleCondition[];
  hints: [string, string, string];
  successText?: string;
};

export type PuzzleRuntimeState = {
  objectStates: Record<string, string>;
  visibility: Record<string, boolean>;
  positions: Record<string, PuzzlePoint>;
  triggeredRules: string[];
  wrongActions: number;
  completed: boolean;
};

export type PuzzleEvent = {
  type: PuzzleRule["event"];
  actorId: string;
  targetId?: string;
};
