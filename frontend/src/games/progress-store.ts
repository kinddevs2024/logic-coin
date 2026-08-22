import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { gameCoinReward } from "./rewards";

export type GameId =
  | "tetris"
  | "chess"
  | "2048"
  | "longcat"
  | "gobble"
  | "loops"
  | "brain-tricks"
  | "one-second"
  | "tsvet"
  | "udar"
  | "space-find-number"
  | "brain-training"
  | "find-letter"
  | "volt-match"
  | "geography-quiz"
  | "pulse"
  | "volt-numbers"
  | "math-quiz"
  | "math-duel"
  | "shadow";

export type GameProgress = {
  bestScore: number;
  previousScore: number;
  coins: number;
  lifetimeCoins: number;
  spentCoins: number;
  transferredCoins: number;
  currentLevel: number;
  highestUnlockedLevel: number;
  completedLevels: number[];
  selectedCosmetic: string;
  unlockedCosmetics: string[];
  bestMovesByLevel: Record<string, number>;
  bestTimesByLevel: Record<string, number>;
  hintsUsedByLevel: Record<string, number>;
  plays: number;
  wins: number;
  lastResult: string;
  updatedAt: number;
};

export type GamesProgress = Partial<Record<GameId, GameProgress>>;

const DEFAULT_COSMETIC: Partial<Record<GameId, string>> = {
  longcat: "classic",
  gobble: "classic",
  loops: "minimal",
  "brain-tricks": "bubble",
};

export const EMPTY_GAME_PROGRESS: Readonly<GameProgress> = {
  bestScore: 0,
  previousScore: 0,
  coins: 0,
  lifetimeCoins: 0,
  spentCoins: 0,
  transferredCoins: 0,
  currentLevel: 1,
  highestUnlockedLevel: 1,
  completedLevels: [],
  selectedCosmetic: "classic",
  unlockedCosmetics: ["classic"],
  bestMovesByLevel: {},
  bestTimesByLevel: {},
  hintsUsedByLevel: {},
  plays: 0,
  wins: 0,
  lastResult: "",
  updatedAt: 0,
};

function initialProgress(gameId: GameId): GameProgress {
  const cosmetic = DEFAULT_COSMETIC[gameId] ?? "classic";
  return {
    ...EMPTY_GAME_PROGRESS,
    completedLevels: [],
    bestMovesByLevel: {},
    selectedCosmetic: cosmetic,
    unlockedCosmetics: [cosmetic],
  };
}

const DEFAULT_GAME_PROGRESS: Partial<Record<GameId, Readonly<GameProgress>>> = {
  tetris: initialProgress("tetris"),
  chess: initialProgress("chess"),
  "2048": initialProgress("2048"),
  longcat: initialProgress("longcat"),
  gobble: initialProgress("gobble"),
  loops: initialProgress("loops"),
  "brain-tricks": initialProgress("brain-tricks"),
  "one-second": initialProgress("one-second"),
  tsvet: initialProgress("tsvet"),
  udar: initialProgress("udar"),
  "space-find-number": initialProgress("space-find-number"),
  "brain-training": initialProgress("brain-training"),
  "find-letter": initialProgress("find-letter"),
  "volt-match": initialProgress("volt-match"),
  "geography-quiz": initialProgress("geography-quiz"),
  pulse: initialProgress("pulse"),
  "volt-numbers": initialProgress("volt-numbers"),
  "math-quiz": initialProgress("math-quiz"),
  "math-duel": initialProgress("math-duel"),
  shadow: initialProgress("shadow"),
};

function normalizeProgress(value: Partial<GameProgress> | undefined, gameId: GameId = "tetris"): GameProgress {
  const base = initialProgress(gameId);
  return {
    ...base,
    ...value,
    coins: Math.max(0, Math.round(value?.coins ?? 0)),
    lifetimeCoins: Math.max(0, Math.round(value?.lifetimeCoins ?? value?.coins ?? 0)),
    spentCoins: Math.max(0, Math.round(value?.spentCoins ?? 0)),
    transferredCoins: Math.max(0, Math.round(value?.transferredCoins ?? 0)),
    completedLevels: Array.from(new Set(value?.completedLevels ?? [])).sort((a, b) => a - b),
    unlockedCosmetics: Array.from(new Set(value?.unlockedCosmetics ?? base.unlockedCosmetics)),
    bestMovesByLevel: value?.bestMovesByLevel ?? {},
    bestTimesByLevel: value?.bestTimesByLevel ?? {},
    hintsUsedByLevel: value?.hintsUsedByLevel ?? {},
  };
}

type GameProgressState = {
  hydrated: boolean;
  games: GamesProgress;
  setHydrated: (hydrated: boolean) => void;
  recordScore: (gameId: GameId, score: number, result?: string, won?: boolean) => void;
  completeLevel: (
    gameId: GameId,
    level: number,
    stats?: { score?: number; moves?: number; time?: number; hints?: number; result?: string },
  ) => string[];
  setCurrentLevel: (gameId: GameId, level: number) => void;
  selectCosmetic: (gameId: GameId, cosmeticId: string) => void;
  purchaseCosmetic: (gameId: GameId, cosmeticId: string, price: number) => boolean;
  awardCoins: (gameId: GameId, amount: number) => number;
  transferCoins: (gameId: GameId, amount?: number) => number;
  mergeRemote: (remote: GamesProgress) => GamesProgress;
};

export const useGameProgressStore = create<GameProgressState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      games: {},
      setHydrated: (hydrated) => set({ hydrated }),
      recordScore: (gameId, score, result = "", won = false) =>
        set((state) => {
          const current = normalizeProgress(state.games[gameId], gameId);
          const coinReward = gameCoinReward(score, won);
          return {
            games: {
              ...state.games,
              [gameId]: {
                ...current,
                bestScore: Math.max(current.bestScore, Math.max(0, Math.round(score))),
                previousScore: Math.max(0, Math.round(score)),
                coins: current.coins + coinReward,
                lifetimeCoins: current.lifetimeCoins + coinReward,
                plays: current.plays + 1,
                wins: current.wins + (won ? 1 : 0),
                lastResult: result,
                updatedAt: Date.now(),
              },
            },
          };
        }),
      completeLevel: (gameId, level, stats = {}) => {
        const current = normalizeProgress(get().games[gameId], gameId);
        const firstCompletion = !current.completedLevels.includes(level);
        const coinReward = firstCompletion ? 25 + Math.min(25, level) : 5;
        const newlyUnlocked: string[] = [];
        const completedLevels = Array.from(
          new Set([...current.completedLevels, level]),
        ).sort((a, b) => a - b);
        const nextBestMoves = { ...current.bestMovesByLevel };
        if (stats.moves !== undefined) {
          const key = String(level);
          nextBestMoves[key] = nextBestMoves[key]
            ? Math.min(nextBestMoves[key], stats.moves)
            : stats.moves;
        }
        const nextBestTimes = { ...current.bestTimesByLevel };
        if (stats.time !== undefined) {
          const key = String(level);
          nextBestTimes[key] = nextBestTimes[key]
            ? Math.min(nextBestTimes[key], stats.time)
            : stats.time;
        }
        const nextHints = { ...current.hintsUsedByLevel };
        if (stats.hints !== undefined) nextHints[String(level)] = stats.hints;
        const next: GameProgress = {
          ...current,
          bestScore:
            stats.score === undefined
              ? current.bestScore
              : Math.max(current.bestScore, Math.round(stats.score)),
          previousScore:
            stats.score === undefined ? current.previousScore : Math.round(stats.score),
          coins: current.coins + coinReward,
          lifetimeCoins: current.lifetimeCoins + coinReward,
          completedLevels,
          currentLevel: Math.max(current.currentLevel, level + 1),
          highestUnlockedLevel: Math.max(current.highestUnlockedLevel, level + 1),
          unlockedCosmetics: [...current.unlockedCosmetics, ...newlyUnlocked],
          bestMovesByLevel: nextBestMoves,
          bestTimesByLevel: nextBestTimes,
          hintsUsedByLevel: nextHints,
          plays: current.plays + 1,
          wins: current.wins + 1,
          lastResult: stats.result ?? `level-${level}`,
          updatedAt: Date.now(),
        };
        set((state) => ({ games: { ...state.games, [gameId]: next } }));
        return newlyUnlocked;
      },
      setCurrentLevel: (gameId, level) =>
        set((state) => {
          const current = normalizeProgress(state.games[gameId], gameId);
          const safeLevel = Math.max(1, Math.min(level, current.highestUnlockedLevel));
          return {
            games: {
              ...state.games,
              [gameId]: { ...current, currentLevel: safeLevel, updatedAt: Date.now() },
            },
          };
        }),
      selectCosmetic: (gameId, cosmeticId) =>
        set((state) => {
          const current = normalizeProgress(state.games[gameId], gameId);
          if (!current.unlockedCosmetics.includes(cosmeticId)) return state;
          return {
            games: {
              ...state.games,
              [gameId]: {
                ...current,
                selectedCosmetic: cosmeticId,
                updatedAt: Date.now(),
              },
            },
          };
        }),
      purchaseCosmetic: (gameId, cosmeticId, price) => {
        const safePrice = Math.max(0, Math.round(price));
        const current = normalizeProgress(get().games[gameId], gameId);
        if (current.unlockedCosmetics.includes(cosmeticId)) {
          get().selectCosmetic(gameId, cosmeticId);
          return true;
        }
        if (current.coins < safePrice) return false;
        set((state) => ({
          games: {
            ...state.games,
            [gameId]: {
              ...current,
              coins: current.coins - safePrice,
              spentCoins: current.spentCoins + safePrice,
              selectedCosmetic: cosmeticId,
              unlockedCosmetics: [...current.unlockedCosmetics, cosmeticId],
              updatedAt: Date.now(),
            },
          },
        }));
        return true;
      },
      awardCoins: (gameId, amount) => {
        const safeAmount = Math.max(0, Math.round(amount));
        if (!safeAmount) return 0;
        const current = normalizeProgress(get().games[gameId], gameId);
        set((state) => ({
          games: {
            ...state.games,
            [gameId]: {
              ...current,
              coins: current.coins + safeAmount,
              lifetimeCoins: current.lifetimeCoins + safeAmount,
              updatedAt: Date.now(),
            },
          },
        }));
        return safeAmount;
      },
      transferCoins: (gameId, amount) => {
        const current = normalizeProgress(get().games[gameId], gameId);
        const requested = amount === undefined ? current.coins : Math.max(0, Math.round(amount));
        const coinAmount = Math.floor(Math.min(current.coins, requested) / 10) * 10;
        if (!coinAmount) return 0;
        set((state) => ({
          games: {
            ...state.games,
            [gameId]: {
              ...current,
              coins: current.coins - coinAmount,
              transferredCoins: current.transferredCoins + coinAmount,
              updatedAt: Date.now(),
            },
          },
        }));
        return coinAmount / 10;
      },
      mergeRemote: (remote) => {
        const local = get().games;
        const merged: GamesProgress = { ...local };
        for (const gameId of Object.keys(remote) as GameId[]) {
          const remoteProgress = normalizeProgress(remote[gameId], gameId);
          const localProgress = local[gameId];
          if (!localProgress || remoteProgress.updatedAt > localProgress.updatedAt) {
            merged[gameId] = remoteProgress;
          }
        }
        set({ games: merged });
        return merged;
      },
    }),
    {
      name: "logic-coin-games-v1",
      version: 4,
      storage: createJSONStorage(() => AsyncStorage),
      skipHydration: Platform.OS === "web",
      migrate: (persisted) => {
        const state = (persisted ?? {}) as { games?: GamesProgress };
        const games = { ...(state.games ?? {}) } as Record<string, GameProgress>;
        delete games["gold-rush-2048"];
        for (const gameId of Object.keys(games) as GameId[]) games[gameId] = normalizeProgress(games[gameId], gameId);
        return { ...state, games: games as GamesProgress } as GameProgressState;
      },
      partialize: ({ hydrated: _hydrated, ...state }) => state,
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);

export function gameProgressFor(
  games: GamesProgress,
  gameId: GameId,
): Readonly<GameProgress> {
  return games[gameId] ?? DEFAULT_GAME_PROGRESS[gameId] ?? initialProgress(gameId);
}
