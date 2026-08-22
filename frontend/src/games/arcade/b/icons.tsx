import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

export type ArcadeIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type ArcadeIconProps = Pick<ComponentProps<typeof MaterialCommunityIcons>, "color" | "size" | "style"> & {
  name: ArcadeIconName;
};

export function ArcadeIcon({ name, color = "#F8FAFF", size = 24, style }: ArcadeIconProps) {
  return <MaterialCommunityIcons accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name={name} color={color} size={size} style={style} />;
}

export const GAME_B_ICONS = {
  geography: "earth",
  pulse: "access-point",
  voltNumbers: "counter",
  mathQuiz: "calculator-variant-outline",
  mathDuel: "head-cog-outline",
  shadowMatch: "eye-outline",
} as const satisfies Record<string, ArcadeIconName>;

export const MATH_OPERATION_ICONS = {
  "+": ["plus-circle-outline", "star-outline", "rocket-launch-outline", "target"],
  "−": ["minus-circle-outline", "diamond-stone", "fire", "palette-outline"],
  "×": ["multiplication-box", "lightning-bolt", "atom", "ferris-wheel"],
  "÷": ["division-box", "brain", "key-outline", "waves"],
} as const satisfies Record<"+" | "−" | "×" | "÷", readonly ArcadeIconName[]>;

export const SHADOW_ICON_POOL = [
  "dog", "cat", "fish", "bird", "duck", "elephant", "penguin", "panda", "rabbit", "cow", "pig", "bee",
  "butterfly", "snail", "snake", "spider", "turtle", "horse", "dolphin", "shark", "jellyfish", "ladybug", "owl", "bat",
  "seal", "koala", "waves", "fire", "star", "pizza", "gamepad-variant", "rocket-launch", "diamond-stone", "weather-sunset",
  "weather-night", "snowflake", "target", "food-apple", "flower", "ferris-wheel", "ice-cream", "trophy", "guitar-electric", "cactus",
  "unicorn-variant", "clover", "drama-masks", "lightbulb-on", "crystal-ball", "earth", "mushroom", "palette", "fishbowl", "billiards",
  "flash", "magnet", "fruit-citrus", "flower-tulip", "dice-multiple", "flower-pollen", "fruit-grapes", "weather-sunny", "weather-lightning",
  "music", "camera", "compass-outline", "map", "tree", "leaf", "paw", "rocket", "atom", "crown", "cards-playing-outline", "chess-knight",
] as const satisfies readonly ArcadeIconName[];
