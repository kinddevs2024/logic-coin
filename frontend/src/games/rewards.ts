export const MAX_GAME_COIN_REWARD = 1_000;
export const MIN_GAME_COIN_REWARD = 0;

export const GAME_REWARD_TARGETS: Record<string, number> = {
  "one-second": 40_000, udar: 60_000, strike: 60_000, "reflex-hit": 60_000,
  tsvet: 6_000, "color-stroop": 6_000, "color-focus": 6_000,
  "volt-match": 6_000, "find-letter": 3_000, "brain-training": 1_000,
  "space-find-number": 10_000, "find-number": 10_000,
  "geography-quiz": 2_000, "geo-master": 2_000, "volt-numbers": 10_000,
  "math-quiz": 1_000, "math-duel": 2_000, shadow: 2_000, "shadow-match": 2_000,
  "2048": 5_000, tetris: 10_000,
};

export function questionRewardScore(correct: number, total: number): number {
  if (!Number.isFinite(correct) || !Number.isSafeInteger(total) || total <= 0) return 0;
  return Math.round(Math.max(0, Math.min(total, correct)) * 1000 / total);
}

/**
 * The single reward contract shared by game UIs and persisted progress.
 *
 * Keep this function deterministic: the host persists exactly the same amount
 * that the result screen previews. Scores are normalized here so malformed or
 * non-finite values can never create an invalid balance.
 */
export function gameCoinReward(score: number, _won = false, gameKey?: string): number {
  if (gameKey === "bottle-flip") return _won ? 50 : 0;
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
  if (safeScore === 0) return 0;
  const normalized = safeScore * 1000 / (GAME_REWARD_TARGETS[gameKey ?? ""] ?? 1000);
  // Earn from zero, proportionally to actions. Above the nominal full-round
  // reward, grow softly instead of cutting earnings at a hard ceiling.
  return Math.round(normalized <= 1000 ? normalized : 1000 + 200 * Math.log2(normalized / 1000));
}
