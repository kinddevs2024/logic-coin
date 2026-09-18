export const LEGACY_GAME_KEY_ALIASES = {
  "color-focus": "tsvet",
  "reflex-hit": "udar",
  "shadow-match": "shadow",
  // Older clients and one catalog import used the plural spelling. Keep it
  // routable so the game opens instead of falling into the unconnected view.
  facts: "fact"
} as const;

export type LegacyGameKey = keyof typeof LEGACY_GAME_KEY_ALIASES;

export function canonicalGameKey(gameKey: string): string {
  const normalized = gameKey.trim().toLowerCase();
  return LEGACY_GAME_KEY_ALIASES[normalized as LegacyGameKey] ?? normalized;
}

export function isLegacyGameKey(gameKey: string): gameKey is LegacyGameKey {
  return Object.prototype.hasOwnProperty.call(LEGACY_GAME_KEY_ALIASES, gameKey);
}
