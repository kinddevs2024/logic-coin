import type {
  PuzzleCondition,
  PuzzleDefinition,
  PuzzleEffect,
  PuzzleEvent,
  PuzzlePoint,
  PuzzleRuntimeState,
} from "./types";

export function createPuzzleState(level: PuzzleDefinition): PuzzleRuntimeState {
  return {
    objectStates: Object.fromEntries(level.objects.map((object) => [object.id, object.state ?? "idle"])),
    visibility: Object.fromEntries(level.objects.map((object) => [object.id, object.visible !== false])),
    positions: Object.fromEntries(level.objects.map((object) => [object.id, { ...object.position }])),
    triggeredRules: [],
    wrongActions: 0,
    completed: false,
  };
}

function prerequisitesMet(state: PuzzleRuntimeState, prerequisites: { objectId: string; state: string }[] = []) {
  return prerequisites.every((item) => state.objectStates[item.objectId] === item.state);
}

function applyEffect(state: PuzzleRuntimeState, effect: PuzzleEffect): PuzzleRuntimeState {
  if (effect.type === "setState") {
    return { ...state, objectStates: { ...state.objectStates, [effect.objectId]: effect.state } };
  }
  if (effect.type === "show" || effect.type === "hide") {
    return { ...state, visibility: { ...state.visibility, [effect.objectId]: effect.type === "show" } };
  }
  return { ...state, positions: { ...state.positions, [effect.objectId]: { ...effect.position } } };
}

export function conditionMet(state: PuzzleRuntimeState, condition: PuzzleCondition) {
  if (condition.type === "stateEquals") return state.objectStates[condition.objectId] === condition.state;
  if (condition.type === "visibleEquals") return state.visibility[condition.objectId] === condition.visible;
  return state.triggeredRules.includes(condition.ruleId);
}

export function isPuzzleSolved(level: PuzzleDefinition, state: PuzzleRuntimeState) {
  return level.successConditions.every((condition) => conditionMet(state, condition));
}

export function applyPuzzleEvent(level: PuzzleDefinition, state: PuzzleRuntimeState, event: PuzzleEvent) {
  if (state.completed) return state;
  const rule = level.rules.find((candidate) =>
    candidate.event === event.type
    && candidate.actorId === event.actorId
    && (candidate.targetId ?? "") === (event.targetId ?? "")
    && (!candidate.once || !state.triggeredRules.includes(candidate.id))
    && prerequisitesMet(state, candidate.prerequisites),
  );
  if (!rule) return { ...state, wrongActions: state.wrongActions + 1 };
  let next: PuzzleRuntimeState = {
    ...state,
    triggeredRules: [...state.triggeredRules, rule.id],
  };
  for (const effect of rule.effects) next = applyEffect(next, effect);
  return { ...next, completed: isPuzzleSolved(level, next) };
}

export function updatePuzzlePosition(state: PuzzleRuntimeState, objectId: string, position: PuzzlePoint) {
  return { ...state, positions: { ...state.positions, [objectId]: { x: Math.max(0, Math.min(100, position.x)), y: Math.max(0, Math.min(100, position.y)) } } };
}

export function pointInsideObject(point: PuzzlePoint, center: PuzzlePoint, size: number) {
  const radius = Math.max(6, size * 0.58);
  return Math.hypot(point.x - center.x, point.y - center.y) <= radius;
}

export function resetPuzzle(level: PuzzleDefinition) {
  return createPuzzleState(level);
}

export function nextHint(level: PuzzleDefinition, hintsUsed: number) {
  return level.hints[Math.min(level.hints.length - 1, hintsUsed)];
}

export function normalizedToPixels(point: PuzzlePoint, width: number, height: number) {
  return { x: (point.x / 100) * width, y: (point.y / 100) * height };
}

export function pixelsToNormalized(point: PuzzlePoint, width: number, height: number) {
  return { x: width ? (point.x / width) * 100 : 0, y: height ? (point.y / height) * 100 : 0 };
}

export function validatePuzzleDefinition(level: PuzzleDefinition) {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const object of level.objects) {
    if (ids.has(object.id)) errors.push(`Duplicate object id: ${object.id}`);
    ids.add(object.id);
    if (object.position.x < 0 || object.position.x > 100 || object.position.y < 0 || object.position.y > 100) errors.push(`Invalid position: ${object.id}`);
  }
  for (const rule of level.rules) {
    if (!ids.has(rule.actorId)) errors.push(`Missing actor: ${rule.actorId}`);
    if (rule.targetId && !ids.has(rule.targetId)) errors.push(`Missing target: ${rule.targetId}`);
    for (const effect of rule.effects) if ("objectId" in effect && !ids.has(effect.objectId)) errors.push(`Missing effect object: ${effect.objectId}`);
  }
  for (const condition of level.successConditions) {
    if ("objectId" in condition && !ids.has(condition.objectId)) errors.push(`Missing condition object: ${condition.objectId}`);
    if (condition.type === "ruleTriggered" && !level.rules.some((rule) => rule.id === condition.ruleId)) errors.push(`Missing condition rule: ${condition.ruleId}`);
  }
  if (level.hints.length < 2 || level.hints.some((hint) => !hint.trim())) errors.push("Hints are required");
  return { valid: errors.length === 0, errors };
}

