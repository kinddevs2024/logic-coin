import { useCallback, useEffect, useRef, useState } from "react";

export function useElapsedClock(active: boolean, resolution = 100) {
  const startedAt = useRef(0);
  const carried = useRef(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active) return;
    startedAt.current = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(carried.current + Date.now() - startedAt.current);
    }, resolution);
    return () => {
      carried.current += Date.now() - startedAt.current;
      clearInterval(timer);
    };
  }, [active, resolution]);

  const reset = useCallback(() => {
    startedAt.current = Date.now();
    carried.current = 0;
    setElapsedMs(0);
  }, []);

  return { elapsedMs, reset };
}

export function useDeadline(active: boolean, durationMs: number, onExpire: () => void, resolution = 50) {
  const callback = useRef(onExpire);
  const deadline = useRef(0);
  const expired = useRef(false);
  const [remainingMs, setRemainingMs] = useState(durationMs);

  useEffect(() => {
    callback.current = onExpire;
  }, [onExpire]);

  const restart = useCallback((nextDuration = durationMs) => {
    deadline.current = Date.now() + nextDuration;
    expired.current = false;
    setRemainingMs(nextDuration);
  }, [durationMs]);

  useEffect(() => {
    if (!active) return;
    if (!deadline.current || expired.current) restart(durationMs);
    const timer = setInterval(() => {
      const next = Math.max(0, deadline.current - Date.now());
      setRemainingMs(next);
      if (next <= 0 && !expired.current) {
        expired.current = true;
        callback.current();
      }
    }, resolution);
    return () => clearInterval(timer);
  }, [active, durationMs, resolution, restart]);

  return { remainingMs, restart };
}
