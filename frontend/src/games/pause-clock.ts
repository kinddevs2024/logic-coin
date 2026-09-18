import { useEffect, useRef, type MutableRefObject } from "react";

/* eslint-disable react-hooks/immutability -- Clock refs are an explicit mutable timer API. */

/** Keeps Date.now()-based clocks stable while a host overlay is open. */
export function usePauseClock(paused: boolean, clocks: MutableRefObject<number>[]) {
  const pausedAt = useRef<number | null>(null);
  // Game screens pass their clocks as an inline array. Keep the latest list in a
  // ref so opening a host overlay does not restart this effect on every render.
  const clocksRef = useRef(clocks);
  useEffect(() => { clocksRef.current = clocks; });

  useEffect(() => {
    if (paused) {
      if (pausedAt.current === null) pausedAt.current = Date.now();
      return;
    }
    if (pausedAt.current === null) return;
    const duration = Date.now() - pausedAt.current;
    for (const clock of clocksRef.current) {
      if (clock.current > 0) clock.current += duration;
    }
    pausedAt.current = null;
  }, [paused]);
}
