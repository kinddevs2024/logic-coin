export function remainingTime(deadline: string | null, serverNow: string, receivedAt: number, now: number) {
  const end = deadline ? Date.parse(deadline) : NaN;
  const current = Date.parse(serverNow) + now - receivedAt;
  if (!Number.isFinite(end) || !Number.isFinite(current)) return null;
  const seconds = Math.max(0, Math.ceil((end - current) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, "0")).join(":");
}
