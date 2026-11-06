// Only settled content screens are ad boundaries, never game/auth/admin routes.
export function isAdNavigationScreen(path: string): boolean {
  return ["/", "/challenges", "/games", "/messages", "/settings", "/invite"].includes(path);
}
export function shouldShowNavigationAd(previous: string | null, next: string): boolean {
  return previous !== null && previous !== next && isAdNavigationScreen(previous) && isAdNavigationScreen(next);
}
