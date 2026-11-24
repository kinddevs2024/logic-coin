export function isRankingSnapshotExpired(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const response = error as { status?: unknown; code?: unknown };
  return response.status === 409 && response.code === "ranking_expired";
}

export function shouldRetryRankingPage(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && !isRankingSnapshotExpired(error);
}

export function createRankingSnapshotRecovery() {
  let attempted = false;
  return {
    shouldReset(error: unknown) {
      if (attempted || !isRankingSnapshotExpired(error)) return false;
      attempted = true;
      return true;
    },
    allowNextReset() { attempted = false; },
  };
}
