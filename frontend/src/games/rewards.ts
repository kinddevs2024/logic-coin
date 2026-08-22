export const MAX_GAME_COIN_REWARD = 1_000;
export const MIN_GAME_COIN_REWARD = 25;

/**
 * The single reward contract shared by game UIs and persisted progress.
 *
 * Keep this function deterministic: the host persists exactly the same amount
 * that the result screen previews. Scores are normalized here so malformed or
 * non-finite values can never create an invalid balance.
 */
export function gameCoinReward(score: number, _won = false): number {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
  const performance = Math.floor(safeScore / 20);
  return Math.min(
    MAX_GAME_COIN_REWARD,
    Math.max(MIN_GAME_COIN_REWARD, MIN_GAME_COIN_REWARD + performance),
  );
}
