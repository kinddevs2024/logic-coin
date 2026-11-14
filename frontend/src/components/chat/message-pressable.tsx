import { useEffect, useRef, type ComponentProps, type MouseEvent, type KeyboardEvent } from "react";
import { Platform, Pressable, type GestureResponderEvent, type PointerEvent } from "react-native";
import type { ChatAnchor } from "./chat-popover";

type Props = Omit<ComponentProps<typeof Pressable>, "onPress" | "onLongPress"> & {
  onActions: (anchor: ChatAnchor) => void;
};
/** A message is readable/selectable on click; its menu uses a context gesture. */
export function MessagePressable({ onActions, ...props }: Props) {
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearClickGuard = useRef<() => void>(() => {});
  const start = useRef<{ x: number; y: number } | null>(null);
  const cancelHold = () => { clearTimeout(hold.current); hold.current = undefined; start.current = null; };
  useEffect(() => {
    if (Platform.OS !== "web") return cancelHold;
    document.addEventListener("scroll", cancelHold, true);
    return () => { cancelHold(); clearClickGuard.current(); document.removeEventListener("scroll", cancelHold, true); };
  }, []);
  // A browser may synthesize a click at the release point after a long touch.
  // Do not let that click dismiss the newly mounted menu backdrop.
  function guardReleaseClick(anchor: ChatAnchor) {
    clearClickGuard.current();
    let timeout: ReturnType<typeof setTimeout>;
    const clear = () => { document.removeEventListener("click", block, true); clearTimeout(timeout); };
    const block = (event: globalThis.MouseEvent) => {
      if (Math.hypot(event.clientX - anchor.x, event.clientY - anchor.y) > 24) return;
      event.preventDefault(); event.stopImmediatePropagation(); clear();
    };
    document.addEventListener("click", block, true);
    timeout = setTimeout(clear, 1000);
    clearClickGuard.current = clear;
  }
  const openFromPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onActions({
      x: event.nativeEvent.pageX - (Platform.OS === "web" ? window.scrollX : 0),
      y: event.nativeEvent.pageY - (Platform.OS === "web" ? window.scrollY : 0),
    });
  };
  const webEvents = Platform.OS === "web" ? {
    onPointerDown: (event: PointerEvent) => {
      cancelHold();
      const point = event.nativeEvent;
      if (point.pointerType !== "touch" && point.pointerType !== "pen") return;
      const anchor = { x: point.pageX - window.scrollX, y: point.pageY - window.scrollY };
      start.current = anchor;
      hold.current = setTimeout(() => { cancelHold(); guardReleaseClick(anchor); onActions(anchor); }, 450);
    },
    onPointerMove: (event: PointerEvent) => {
      if (start.current && Math.hypot(event.nativeEvent.pageX - window.scrollX - start.current.x, event.nativeEvent.pageY - window.scrollY - start.current.y) > 10) cancelHold();
    },
    onPointerUp: cancelHold,
    onPointerCancel: cancelHold,
    onPointerLeave: cancelHold,
    onContextMenu: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault(); event.stopPropagation(); cancelHold();
      onActions({ x: event.clientX, y: event.clientY });
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget || !(event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) return;
      event.preventDefault(); event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      onActions({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    },
  } : {};
  return <Pressable {...props} {...webEvents} delayLongPress={450} onLongPress={Platform.OS === "web" ? undefined : openFromPress} />;
}
