export const LEGACY_GAME_KEY_ALIASES = {
  "color-focus": "tsvet",
  "reflex-hit": "udar",
  "shadow-match": "shadow"
} as const;

export type LegacyGameKey = keyof typeof LEGACY_GAME_KEY_ALIASES;

export function canonicalGameKey(gameKey: string): string {
  const normalized = gameKey.trim().toLowerCase();
  return LEGACY_GAME_KEY_ALIASES[normalized as LegacyGameKey] ?? normalized;
}

export function isLegacyGameKey(gameKey: string): gameKey is LegacyGameKey {
  return Object.hasOwn(LEGACY_GAME_KEY_ALIASES, gameKey);
}
