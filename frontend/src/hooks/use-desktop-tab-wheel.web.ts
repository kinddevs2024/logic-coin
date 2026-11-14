import { useEffect, useRef } from "react";
import { useIsFocused, usePathname, useRouter } from "expo-router";
import type { View } from "react-native";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import {
  canScrollVertically,
  createDesktopWheelGate,
  desktopTabRoutes,
  wheelPixels,
  type DesktopTabRoute,
} from "@/lib/desktop-tab-wheel";

const gate = createDesktopWheelGate();
let arrival: { path: DesktopTabRoute; direction: number } | null = null;
const ignoredTargets = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="spinbutton"], [role="dialog"], [aria-modal="true"], [data-no-swipe], [data-no-wheel-navigation]';

export function useDesktopTabWheel({ disabled }: { disabled?: boolean } = {}) {
  const rootRef = useRef<View | null>(null);
  const focused = useIsFocused();
  const path = usePathname();
  const router = useRouter();
  const { isDesktop } = useResponsiveLayout();

  useEffect(() => {
    if (disabled || !focused || !isDesktop || !desktopTabRoutes.some(route => route === path)) return;
    const root = rootRef.current as unknown as HTMLElement | null;
    if (!root?.addEventListener) return;
    const getMain = () => root.querySelector<HTMLElement>('[role="main"]');
    const frame = requestAnimationFrame(() => {
      if (arrival?.path !== path) return;
      const main = getMain();
      if (main) main.scrollTop = arrival.direction > 0 ? 0 : main.scrollHeight;
      arrival = null;
    });
    const handleWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
          Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const target = event.target instanceof Element ? event.target : null;
      const main = getMain();
      if (!target || !main || !main.contains(target) || target.closest(ignoredTargets) ||
          root.closest('[aria-hidden="true"], [inert]')) return;
      // Portalled dialogs must also disable background section navigation.
      if (Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]'))
        .some(dialog => dialog.getClientRects().length > 0 && getComputedStyle(dialog).visibility !== "hidden")) return;
      // A mini-ranking, horizontal carousel or editor owns its entire gesture,
      // including its edge; don't turn nested scrolling into page navigation.
      for (let node: Element | null = target; node && node !== main; node = node.parentElement) {
        const style = getComputedStyle(node);
        if ((/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2) ||
            (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 2)) return;
      }
      const delta = wheelPixels(event.deltaY, event.deltaMode, main.clientHeight);
      const result = gate.step(path, delta, performance.now(), canScrollVertically(main, delta));
      if (result.consume) event.preventDefault();
      if (result.route) {
        arrival = { path: result.route, direction: Math.sign(delta) };
        router.navigate(result.route);
      }
    };
    // Non-passive is required only here to consume a section-changing gesture;
    // regular page scrolling is left to the browser.
    root.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("wheel", handleWheel);
    };
  }, [disabled, focused, isDesktop, path, router]);

  return rootRef;
}
