const PRACTICE_ATTEMPTS = 38;
const CHALLENGE_ATTEMPTS = 7;

/** Internal hits in one game, not the admin's allowance for full-game replays. */
export function strikeRules(challengeMode = false) {
  // This is a global challenge rule, independent of a day's date/configuration.
  // Keep practice exactly as before and do not inherit stale server limits.
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
