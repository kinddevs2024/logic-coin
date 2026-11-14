/** A corrupt or unresponsive local cache must never hide the entire navigator. */
export function beginCacheBoot<T>(open: () => Promise<T>, loaded: (value: T, late: boolean) => void, ready: () => void, milliseconds = 4000) {
  let disposed = false, late = false;
  const timer = setTimeout(() => { late = true; if (!disposed) ready(); }, milliseconds);
  void Promise.resolve().then(open).then(value => { if (!disposed) loaded(value, late); })
    .catch(() => {})
    .finally(() => { clearTimeout(timer); if (!disposed) ready(); });
  return () => { disposed = true; clearTimeout(timer); };
}
