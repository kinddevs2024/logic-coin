import type { GameCatalogItem, Language } from "@/types";

export type LocalizedGame = GameCatalogItem & {
  names: Record<Language, string>;
  descriptions: Record<Language, string>;
  family: "classic" | "arcade-a" | "arcade-b";
};

const game = (
  input: Omit<LocalizedGame, "id" | "slug" | "engine" | "challengeEnabled" | "practiceEnabled" | "title" | "description">,
): LocalizedGame => ({
  ...input,
  id: input.key,
  slug: input.key,
  engine: "native",
  challengeEnabled: true,
  practiceEnabled: true,
  title: input.names.ru,
  description: input.descriptions.ru,
});

export const GAME_CATALOG: LocalizedGame[] = [
  game({ key: "one-second", icon: "timer-outline", color: "#7C6FFF", difficulty: "hard", family: "arcade-a", names: { ru: "1 секунда", en: "One Second", uz: "Bir soniya" }, descriptions: { ru: "Почувствуйте идеальную секунду", en: "Feel the perfect second", uz: "Mukammal soniyani his qiling" } }),
  game({ key: "tsvet", icon: "color-palette-outline", color: "#EC4899", difficulty: "medium", family: "arcade-a", names: { ru: "Цвет", en: "Color", uz: "Rang" }, descriptions: { ru: "Выбирайте цвет, а не слово", en: "Choose the ink, not the word", uz: "So‘zni emas, rangni tanlang" } }),
  game({ key: "udar", icon: "flash-outline", color: "#FF3B30", difficulty: "medium", family: "arcade-a", names: { ru: "Удар", en: "Strike", uz: "Zarba" }, descriptions: { ru: "Попадите точно в центр", en: "Hit the exact center", uz: "Aniq markazga uring" } }),
  game({ key: "space-find-number", icon: "planet-outline", color: "#00D8C8", difficulty: "medium", family: "arcade-a", names: { ru: "Космический", en: "Space", uz: "Kosmik" }, descriptions: { ru: "Найдите числа по порядку", en: "Find every number in order", uz: "Sonlarni tartibda toping" } }),
  game({ key: "brain-training", icon: "bulb-outline", color: "#C8A96E", difficulty: "hard", family: "arcade-a", names: { ru: "Мозговой штурм", en: "Brain Storm", uz: "Aql mashqi" }, descriptions: { ru: "Ловите правильные выражения", en: "Catch the right equations", uz: "To‘g‘ri ifodalarni tuting" } }),
  game({ key: "find-letter", icon: "text-outline", color: "#38BDF8", difficulty: "medium", family: "arcade-a", names: { ru: "Найди букву", en: "Find the Letter", uz: "Harfni toping" }, descriptions: { ru: "Найдите повторяющуюся букву", en: "Find the duplicated letter", uz: "Takrorlangan harfni toping" } }),
  game({ key: "volt-match", icon: "scan-outline", color: "#F5C842", difficulty: "hard", family: "arcade-a", names: { ru: "VOLT Match", en: "VOLT Match", uz: "VOLT Match" }, descriptions: { ru: "Найдите все совпадения", en: "Find every matching symbol", uz: "Barcha mos belgilarni toping" } }),
  game({ key: "geography-quiz", icon: "earth-outline", color: "#22C55E", difficulty: "medium", family: "arcade-b", names: { ru: "География", en: "Geography", uz: "Geografiya" }, descriptions: { ru: "Страны, столицы и флаги", en: "Countries, capitals and flags", uz: "Davlatlar, poytaxtlar va bayroqlar" } }),
  game({ key: "fact", icon: "pulse-outline", color: "#FF375F", difficulty: "hard", family: "arcade-b", names: { ru: "Факт", en: "Fact", uz: "Fakt" }, descriptions: { ru: "Проверьте свою реакцию", en: "Test your reaction", uz: "Reaksiyangizni sinang" } }),
  game({ key: "volt-numbers", icon: "keypad-outline", color: "#A855F7", difficulty: "medium", family: "arcade-b", names: { ru: "VOLT Numbers", en: "VOLT Numbers", uz: "VOLT Numbers" }, descriptions: { ru: "Запомните числовую цепочку", en: "Remember the number chain", uz: "Sonlar ketma-ketligini eslang" } }),
  game({ key: "math-quiz", icon: "calculator-outline", color: "#16A34A", difficulty: "medium", family: "arcade-b", names: { ru: "Математика", en: "Math Quiz", uz: "Matematika" }, descriptions: { ru: "Решайте быстрее таймера", en: "Solve before time runs out", uz: "Vaqtdan oldin yeching" } }),
  game({ key: "shadow", icon: "shapes-outline", color: "#64748B", difficulty: "medium", family: "arcade-b", names: { ru: "Тени", en: "Shadows", uz: "Soyalar" }, descriptions: { ru: "Найдите правильный силуэт", en: "Match the right silhouette", uz: "To‘g‘ri soyani toping" } }),
  game({ key: "2048", icon: "apps-outline", color: "#F59E0B", difficulty: "medium", family: "classic", names: { ru: "2048", en: "2048", uz: "2048" }, descriptions: { ru: "Соединяйте числа", en: "Merge the numbers", uz: "Sonlarni birlashtiring" } }),
];

export const GAME_BY_KEY = Object.fromEntries(
  GAME_CATALOG.map((entry) => [entry.key, entry]),
) as Record<string, LocalizedGame>;

export function localizeGame(entry: LocalizedGame, language: Language): GameCatalogItem {
  return {
    ...entry,
    title: entry.names[language],
    description: entry.descriptions[language],
  };
}

export function demoTodayGames(language: Language, count = 6): GameCatalogItem[] {
  const now = new Date();
  const seed = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000);
  const challengePool = GAME_CATALOG.filter((entry) => entry.challengeEnabled);
  const start = Math.abs(seed) % challengePool.length;
  return Array.from({ length: Math.min(count, challengePool.length) }, (_, index) =>
    localizeGame(challengePool[(start + index) % challengePool.length]!, language),
  );
}
