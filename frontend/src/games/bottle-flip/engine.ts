export type BottleGesture = { dx: number; dy: number; durationMs: number; sceneHeight: number; sceneWidth: number };
export function evaluateSwipe({ dx, dy, durationMs, sceneHeight, sceneWidth }: BottleGesture) {
  if (![dx, dy, durationMs, sceneHeight, sceneWidth].every(Number.isFinite) || sceneHeight <= 0 || sceneWidth <= 0 || durationMs <= 0 || dy >= -12) return null;
  const seconds = Math.max(0.07, durationMs / 1000);
  const speed = Math.max(0, Math.min(2.7, -dy / sceneHeight / seconds));
  const lift = 0.65 + speed * 0.65;
  const duration = lift / 2;
  const rotation = (200 + speed * 300) * duration;
  const offsetX = Math.max(-sceneWidth * 0.65, Math.min(sceneWidth * 0.65, dx / seconds * duration * 0.55));
  const onTable = Math.abs(offsetX) <= Math.min(90, sceneWidth * 0.27);
  const landed = Math.abs(rotation - 360) <= 36 && onTable;
  return { landed, verdict: !onTable ? "side" : landed ? "perfect" : rotation < 360 ? "weak" : "strong", rotation: landed ? 360 : rotation, offsetX, durationMs: Math.round(duration * 1000), peak: Math.min(lift * lift / 8 * sceneHeight, Math.max(25, sceneHeight * 0.88 - 225)) } as const;
}
