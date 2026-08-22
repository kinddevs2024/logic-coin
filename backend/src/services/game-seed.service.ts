import { LEGACY_GAME_KEY_ALIASES } from "../lib/game-key.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { Game } from "../models/Game.js";

type SeedGame = {
  key: string;
  icon: string;
  color: string;
  difficulty: "easy" | "medium" | "hard";
  engine: "native" | "webview";
  title: { en: string; ru: string; uz: string };
  description: { en: string; ru: string; uz: string };
  clientPath: string;
  assetPath?: string;
};

const nativeGames: SeedGame[] = [
  ["tetris", "grid", "#087CFF", "medium", "Tetris", "Тетрис", "Tetris"],
  ["chess", "people", "#705CF6", "hard", "Chess", "Шахматы", "Shaxmat"],
  ["2048", "apps", "#F59E0B", "medium", "2048", "2048", "2048"],
  ["longcat", "git-branch", "#F07D5A", "medium", "Trail Cat", "Хвостатый путь", "Uzun mushuk"],
  ["gobble", "radio-button-on", "#8A5CF6", "medium", "Pocket Vortex", "Карманная воронка", "Cho‘ntak girdobi"],
  ["loops", "infinite", "#B45C66", "medium", "Infinity Loop", "Живые линии", "Cheksiz halqa"],
  ["brain-tricks", "bulb", "#27A66F", "medium", "Brain Tricks", "Хитрые мысли", "Aqlli topishmoqlar"]
].map(([key, icon, color, difficulty, en, ru, uz]) => ({
  key,
  icon,
  color,
  difficulty,
  engine: "native",
  title: { en, ru, uz },
  description: {
    en: "Play, improve your score, and unlock new levels.",
    ru: "Играйте, улучшайте результат и открывайте новые уровни.",
    uz: "O‘ynang, natijani yaxshilang va yangi bosqichlarni oching."
  },
  clientPath: `/games/${key}`
})) as SeedGame[];

const importedGames: SeedGame[] = [
  { key: "one-second", icon: "timer", color: "#0EA5E9", difficulty: "hard", title: { en: "One Second", ru: "Одна секунда", uz: "Bir soniya" } },
  { key: "tsvet", icon: "color-palette", color: "#EC4899", difficulty: "medium", title: { en: "Color", ru: "Цвет", uz: "Rang" } },
  { key: "udar", icon: "flash", color: "#F79009", difficulty: "easy", title: { en: "Strike", ru: "Удар", uz: "Zarba" } },
  { key: "space-find-number", icon: "planet", color: "#5945E8", difficulty: "easy", title: { en: "Space Numbers", ru: "Космические числа", uz: "Kosmik raqamlar" } },
  { key: "brain-training", icon: "fitness", color: "#12B76A", difficulty: "medium", title: { en: "Brain Training", ru: "Тренировка мозга", uz: "Miya mashg‘uloti" } },
  { key: "find-letter", icon: "text", color: "#0866FF", difficulty: "easy", title: { en: "Find the Letter", ru: "Найди букву", uz: "Harfni toping" } },
  { key: "volt-match", icon: "grid", color: "#7A5AF8", difficulty: "medium", title: { en: "VOLT Match", ru: "VOLT Матч", uz: "VOLT Match" } },
  { key: "geography-quiz", icon: "earth", color: "#0F9F6E", difficulty: "medium", title: { en: "Geography Quiz", ru: "География", uz: "Geografiya" } },
  { key: "pulse", icon: "pulse", color: "#F43F5E", difficulty: "hard", title: { en: "Pulse", ru: "Пульс", uz: "Puls" } },
  { key: "volt-numbers", icon: "keypad", color: "#8B5CF6", difficulty: "medium", title: { en: "VOLT Numbers", ru: "VOLT Числа", uz: "VOLT Raqamlari" } },
  { key: "math-quiz", icon: "calculator", color: "#16A34A", difficulty: "medium", title: { en: "Math Quiz", ru: "Математическая викторина", uz: "Matematik viktorina" } },
  { key: "math-duel", icon: "git-compare", color: "#DC2626", difficulty: "hard", title: { en: "Math Duel", ru: "Математическая дуэль", uz: "Matematik duel" } },
  { key: "shadow", icon: "shapes", color: "#64748B", difficulty: "medium", title: { en: "Shadows", ru: "Тени", uz: "Soyalar" } }
].map((game) => ({
  ...game,
  engine: "native",
  description: {
    en: "A fast game for attention, memory, and reaction.",
    ru: "Быстрая игра на внимание, память и реакцию.",
    uz: "Diqqat, xotira va reaksiya uchun tezkor o‘yin."
  },
  clientPath: `/play/${game.key}`
})) as SeedGame[];

export const DEFAULT_GAMES = [...nativeGames, ...importedGames] as const;

async function hasGameReferences(gameId: unknown): Promise<boolean> {
  const [challengeSet, attempt] = await Promise.all([
    DailyChallengeSet.exists({ gameIds: gameId }),
    ChallengeAttempt.exists({ gameId })
  ]);
  return Boolean(challengeSet || attempt);
}

export async function retireRemovedGames(): Promise<void> {
  const removed = await Game.findOne({ key: "gold-rush-2048" }).select("_id");
  if (!removed) return;
  if (await hasGameReferences(removed._id)) {
    await Game.updateOne(
      { _id: removed._id },
      { $set: { enabled: false, challengeEnabled: false, practiceEnabled: false } }
    );
    return;
  }
  await Game.deleteOne({ _id: removed._id });
}

/**
 * Renames the three catalog keys shipped by the first backend draft. Existing
 * ObjectIds are kept whenever they are referenced, so challenge history and
 * daily sets remain valid. A conflicting pair with references on both sides is
 * stopped for manual review rather than silently corrupting contest history.
 */
export async function migrateLegacyGameKeys(): Promise<void> {
  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_GAME_KEY_ALIASES)) {
    const [legacy, canonical] = await Promise.all([
      Game.findOne({ key: legacyKey }).select("_id"),
      Game.findOne({ key: canonicalKey }).select("_id")
    ]);
    if (!legacy) continue;

    let target = legacy;
    if (canonical) {
      const [legacyReferenced, canonicalReferenced] = await Promise.all([
        hasGameReferences(legacy._id),
        hasGameReferences(canonical._id)
      ]);
      if (legacyReferenced && canonicalReferenced) {
        throw new Error(
          `Cannot merge legacy game ${legacyKey}: both ${legacyKey} and ${canonicalKey} are referenced`
        );
      }
      if (legacyReferenced) {
        await Game.deleteOne({ _id: canonical._id });
      } else {
        await Game.deleteOne({ _id: legacy._id });
        target = canonical;
      }
    }

    if (target._id.equals(legacy._id)) {
      await Game.updateOne(
        { _id: legacy._id },
        {
          $set: {
            key: canonicalKey,
            slug: canonicalKey,
            engine: "native",
            clientPath: `/play/${canonicalKey}`
          },
          $unset: { assetPath: 1 }
        }
      );
    }
    await ChallengeAttempt.updateMany(
      { gameId: target._id, gameKey: legacyKey },
      { $set: { gameKey: canonicalKey } }
    );
  }
}

export async function seedDefaultGames(): Promise<void> {
  await migrateLegacyGameKeys();
  await retireRemovedGames();
  await Game.bulkWrite(
    DEFAULT_GAMES.map((game, index) => ({
      updateOne: {
        filter: { key: game.key },
        update: {
          $setOnInsert: {
            ...game,
            slug: game.key,
            enabled: true,
            challengeEnabled: true,
            practiceEnabled: true,
            sortOrder: (index + 1) * 10,
            scoring: { higherIsBetter: true, maxCoins: 1_000 }
          }
        },
        upsert: true
      }
    })),
    { ordered: false }
  );
}
