import type { GamesProgress } from "@/games/progress-store";

// These records are kept on the device and excluded from server progress sync.
const localGameKeys = new Set([
  "bottle-flip", "gold-rush-2048", "snake", "minesweeper", "mini-sudoku", "fifteen",
  "tic-tac-toe", "connect-four", "memory-pairs", "simon", "lights-out", "mastermind",
]);

function sortedRecord(record: Record<string, number> | undefined) {
  return Object.fromEntries(Object.entries(record ?? {}).sort(([left], [right]) => left.localeCompare(right)));
}

export function progressSyncSnapshot(games: GamesProgress): GamesProgress {
  const snapshot: GamesProgress = {};
  for (const key of (Object.keys(games) as (keyof GamesProgress)[]).sort()) {
    const game = games[key];
    if (!game || localGameKeys.has(key)) continue;
    snapshot[key] = {
      bestScore: game.bestScore,
      previousScore: game.previousScore,
      // The server always returns zero for these local economy fields.
      coins: 0,
      lifetimeCoins: 0,
      spentCoins: 0,
      transferredCoins: 0,
      currentLevel: game.currentLevel,
      highestUnlockedLevel: game.highestUnlockedLevel,
      completedLevels: Array.from(new Set(game.completedLevels ?? [])).sort((a, b) => a - b),
      selectedCosmetic: game.selectedCosmetic,
      unlockedCosmetics: Array.from(new Set(game.unlockedCosmetics ?? ["classic"])),
      bestMovesByLevel: sortedRecord(game.bestMovesByLevel),
      bestTimesByLevel: sortedRecord(game.bestTimesByLevel),
      hintsUsedByLevel: sortedRecord(game.hintsUsedByLevel),
      plays: game.plays,
      wins: game.wins,
      lastResult: game.lastResult,
      updatedAt: game.updatedAt,
    };
  }
  return snapshot;
}
