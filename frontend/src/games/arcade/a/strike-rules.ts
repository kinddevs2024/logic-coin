const PRACTICE_ATTEMPTS = 38;
const CHALLENGE_ATTEMPTS = 38;

export function strikeSpeed(attempt: number) {
  const safeAttempt = Math.max(1, Math.min(38, Number.isFinite(attempt) ? attempt : 1));
  return Math.min(1.2, 0.35 + (safeAttempt - 1) * 0.035);
}

/** Internal hits in one game, not the admin's allowance for full-game replays. */
export function strikeRules(challengeMode = false) {
  // Use the full short-game sequence in either mode for the new time budget.
  const attemptLimit = challengeMode ? CHALLENGE_ATTEMPTS : PRACTICE_ATTEMPTS;
  const scaledThreshold = (practiceThreshold: number) =>
    Math.ceil((practiceThreshold * attemptLimit) / PRACTICE_ATTEMPTS);

  return {
    attemptLimit,
    winningHits: scaledThreshold(28),
    perfectGradeHits: scaledThreshold(30),
    excellentGradeHits: scaledThreshold(22),
  };
}
