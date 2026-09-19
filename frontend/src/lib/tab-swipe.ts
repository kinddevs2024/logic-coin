export const swipeRoutes = ["/", "/challenges", "/games", "/profile"] as const;
export function tabSwipe(path: string, dx: number, dy: number, elapsed: number) {
  const index = swipeRoutes.findIndex(route => route === path);
  if (index < 0 || elapsed > 700 || elapsed < 0) return null;
  if (Math.abs(dx) >= 70 && Math.abs(dx) > Math.abs(dy) * 1.8) {
    if (index === 0 && dx > 0) return "drawer";
    return swipeRoutes[index + (dx < 0 ? 1 : -1)] ?? null;
  }
  if (index === 0 && dy <= -100 && Math.abs(dy) > Math.abs(dx) * 2 && elapsed <= 450) return "refresh";
  return null;
}
