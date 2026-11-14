import type { VortexEntity, VortexLevel, VortexPoint } from "./types";

export const HUMAN_FAIL_THRESHOLD = 0.68;

export function distance(a: VortexPoint, b: VortexPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function entityInsideHolePercent(
  hole: VortexPoint & { radius: number },
  entity: VortexEntity,
): number {
  const overlap = hole.radius + entity.radius - distance(hole, entity.position);
  return Math.max(0, Math.min(1, overlap / Math.max(entity.radius * 2, 0.001)));
}

export type VortexCollision = "NONE" | "SWALLOW" | "HUMAN_FAIL";

export function evaluateVortexCollision(
  hole: VortexPoint & { radius: number },
  entity: VortexEntity,
): VortexCollision {
  const inside = entityInsideHolePercent(hole, entity);
  if (!entity.edible) return inside >= HUMAN_FAIL_THRESHOLD ? "HUMAN_FAIL" : "NONE";
  if (entity.radius > hole.radius * 0.82) return "NONE";
  return inside >= 0.78 ? "SWALLOW" : "NONE";
}

export function requiredEntityCount(level: VortexLevel): number {
  return level.entities.filter((entity) => entity.edible && entity.required).length;
}

export function clampHole(
  point: VortexPoint,
  radius: number,
): VortexPoint {
  return {
    x: Math.max(radius, Math.min(1 - radius, point.x)),
    y: Math.max(radius, Math.min(1 - radius, point.y)),
  };
}

export function grownHoleRadius(
  level: VortexLevel,
  currentRadius: number,
  swallowedMass: number,
): number {
  if (!level.hole.grow) return currentRadius;
  return Math.min(
    level.hole.maxRadius,
    currentRadius + swallowedMass * level.hole.growthPerMass,
  );
}
