import type { ImageSourcePropType } from "react-native";

const covers: Record<string, ImageSourcePropType> = {
  "one-second": require("../../assets/games/covers/one-second.webp"),
  tsvet: require("../../assets/games/covers/tsvet.webp"),
  udar: require("../../assets/games/covers/udar.webp"),
  "space-find-number": require("../../assets/games/covers/space-find-number.webp"),
  "brain-training": require("../../assets/games/covers/brain-training.webp"),
  "find-letter": require("../../assets/games/covers/find-letter.webp"),
  "volt-match": require("../../assets/games/covers/volt-match.webp"),
  "geography-quiz": require("../../assets/games/covers/geography-quiz.webp"),
  fact: require("../../assets/games/covers/pulse.webp"),
  "volt-numbers": require("../../assets/games/covers/volt-numbers.webp"),
  "math-quiz": require("../../assets/games/covers/math-quiz.webp"),
  shadow: require("../../assets/games/covers/shadow.webp"),
  "2048": require("../../assets/games/covers/2048.webp"),
};

const aliases: Record<string, string> = {
  "color-focus": "tsvet",
  "color-stroop": "tsvet",
  "reflex-hit": "udar",
  strike: "udar",
  "find-number": "space-find-number",
  "geo-master": "geography-quiz",
  "shadow-match": "shadow",
};

export function gameCoverFor(gameKey: string): ImageSourcePropType | undefined {
  return covers[aliases[gameKey] ?? gameKey];
}
