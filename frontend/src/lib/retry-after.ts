export function retryAfterMs(value: string | null, now = Date.now()): number | undefined {
  const header = value?.trim();
  if (!header) return undefined;
  if (/^\d+$/.test(header)) {
    const milliseconds = Number(header) * 1_000;
    return Number.isSafeInteger(milliseconds) ? milliseconds : undefined;
  }
  // Retry-After also accepts an HTTP date. Reject other numeric formats.
  if (!/^[a-z]{3},/i.test(header)) return undefined;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}
