import { useRef } from "react";
import { useIsFocused, usePathname, useRouter } from "expo-router";
import type { GestureResponderEvent } from "react-native";
import { tabSwipe } from "@/lib/tab-swipe";

export function useTabSwipe({ disabled, onOpenProfile, onRefresh }: { disabled?: boolean; onOpenProfile?: () => void; onRefresh?: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const focused = useIsFocused();
  const start = useRef<{ x: number; y: number; time: number } | null>(null);
  return {
    onTouchStart: (event: GestureResponderEvent) => {
      start.current = null;
      const target = event.target as unknown as { closest?: (selector: string) => unknown };
      if (disabled || !focused || event.nativeEvent.touches.length !== 1 || target.closest?.('input, textarea, [role="slider"], [role="dialog"], [data-no-swipe]')) return;
      const touch = event.nativeEvent.touches[0];
      start.current = { x: touch.pageX, y: touch.pageY, time: Date.now() };
    },
    onTouchMove: (event: GestureResponderEvent) => {
      if (event.nativeEvent.touches.length !== 1) start.current = null;
    },
    onTouchCancel: () => { start.current = null; },
    onTouchEnd: (event: GestureResponderEvent) => {
      const origin = start.current;
      start.current = null;
      if (!origin || disabled || !focused) return;
      const touch = event.nativeEvent.changedTouches[0];
      if (!touch) return;
      const action = tabSwipe(path, touch.pageX - origin.x, touch.pageY - origin.y, Date.now() - origin.time);
      if (action === "drawer") onOpenProfile?.();
      else if (action === "refresh") onRefresh?.();
      else if (action) router.navigate(action);
    },
  };
}
