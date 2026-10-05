export const desktopTabRoutes = ["/", "/challenges", "/games", "/profile"] as const;
export type DesktopTabRoute = (typeof desktopTabRoutes)[number];

export function adjacentDesktopTab(path: string, direction: number): DesktopTabRoute | null {
  const index = desktopTabRoutes.findIndex(route => route === path);
  if (index < 0 || !direction) return null;
  return desktopTabRoutes[index + (direction > 0 ? 1 : -1)] ?? null;
}

export function wheelPixels(delta: number, mode: number, pageHeight: number) {
  return delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
}

export function canScrollVertically(
  bounds: { scrollTop: number; scrollHeight: number; clientHeight: number },
  delta: number,
) {
  const remaining = bounds.scrollHeight - bounds.clientHeight;
  if (remaining <= 2) return false;
  return delta > 0 ? bounds.scrollTop < remaining - 2 : bounds.scrollTop > 2;
}

// Shared by the active tab across navigation: trackpad inertia must not skip
// multiple sections or scroll the newly opened page.
export function createDesktopWheelGate() {
  let lastEvent = -Infinity;
  let lastSwitch = -Infinity;
  let amount = 0;
  let direction = 0;
  let latched = false;
  let scrolledThisGesture = false;
  return {
    step(path: string, delta: number, now: number, canScroll: boolean) {
      if (!Number.isFinite(delta) || !delta) return { route: null, consume: false };
      const nextDirection = Math.sign(delta);
      if (now - lastEvent > 220) {
        latched = false;
        scrolledThisGesture = false;
        amount = 0;
      }
      if (nextDirection !== direction) {
        amount = 0;
        scrolledThisGesture = false;
      }
      direction = nextDirection;
      lastEvent = now;
      if (latched) return { route: null, consume: true };
      if (canScroll) {
        scrolledThisGesture = true;
        amount = 0;
        return { route: null, consume: false };
      }
      const route = adjacentDesktopTab(path, direction);
      if (!route || scrolledThisGesture || now - lastSwitch < 650) {
        amount = 0;
        return { route: null, consume: false };
      }
      amount += Math.min(Math.abs(delta), 160);
      if (amount < 90) return { route: null, consume: true };
      amount = 0;
      latched = true;
      lastSwitch = now;
      return { route, consume: true };
    },
  };
}
