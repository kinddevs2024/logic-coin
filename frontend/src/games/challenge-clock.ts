export const MERGE_CHALLENGE_DURATION_MS = 60_000;

export function advanceChallengeClock(remainingMs: number, elapsedMs: number) {
  return Math.max(0, remainingMs - Math.max(0, elapsedMs));
}

export function formatChallengeClock(seconds: number) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
