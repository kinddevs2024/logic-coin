export const BOTTLE_THEME_PRICES: Readonly<Record<string, number>> = { classic: 0, amber: 500, violet: 1500 };
export function bottleThemeOwnership(progress: { bottleThemePricingVersion?: number; selectedCosmetic?: string; unlockedCosmetics?: string[] }) {
  if (progress.bottleThemePricingVersion === 1) return {
    bottleThemePricingVersion: 1,
    selectedCosmetic: progress.selectedCosmetic ?? "classic",
    unlockedCosmetics: progress.unlockedCosmetics ?? ["classic"],
  };
  // Only remove free prototype unlocks. Keep coins, wins and all other progress untouched.
  return { bottleThemePricingVersion: 1, selectedCosmetic: "classic", unlockedCosmetics: ["classic"] };
}
