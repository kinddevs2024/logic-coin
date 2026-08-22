import type { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { GameId } from "./progress-store";

export type GameCosmetic = {
  id: string;
  name: string;
  price: number;
  icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
  primary: string;
  secondary: string;
};

export const GAME_COSMETICS: Partial<Record<GameId, GameCosmetic[]>> = {
  tetris: [
    { id: "classic", name: "Классика", price: 0, icon: "view-grid", primary: "#0EA5E9", secondary: "#7DD3FC" },
    { id: "arcade", name: "Аркада", price: 90, icon: "gamepad-variant", primary: "#8B5CF6", secondary: "#F472B6" },
    { id: "volt", name: "Вольт", price: 180, icon: "lightning-bolt", primary: "#FACC15", secondary: "#22D3EE" },
  ],
  chess: [
    { id: "classic", name: "Классика", price: 0, icon: "chess-king", primary: "#0F172A", secondary: "#CBD5E1" },
    { id: "royal", name: "Королевский", price: 110, icon: "crown", primary: "#7C3AED", secondary: "#FDE68A" },
    { id: "ice", name: "Лёд", price: 220, icon: "snowflake", primary: "#0369A1", secondary: "#BAE6FD" },
  ],
  "2048": [
    { id: "classic", name: "Классика", price: 0, icon: "numeric", primary: "#2563EB", secondary: "#BFDBFE" },
    { id: "gem", name: "Кристалл", price: 100, icon: "diamond-stone", primary: "#DB2777", secondary: "#FBCFE8" },
    { id: "sunset", name: "Закат", price: 200, icon: "weather-sunset", primary: "#EA580C", secondary: "#FED7AA" },
  ],
  longcat: [
    { id: "classic", name: "Лимон", price: 0, icon: "cat", primary: "#FFE500", secondary: "#FFF8A6" },
    { id: "tiger", name: "Тигр", price: 120, icon: "cat", primary: "#F59E0B", secondary: "#FDE68A" },
    { id: "panda", name: "Панда", price: 240, icon: "cat", primary: "#313241", secondary: "#F8FAFC" },
  ],
  gobble: [
    { id: "classic", name: "Коралл", price: 0, icon: "circle-slice-8", primary: "#241F35", secondary: "#F43F5E" },
    { id: "neon", name: "Неон", price: 130, icon: "circle-opacity", primary: "#111827", secondary: "#22D3EE" },
    { id: "galaxy", name: "Галактика", price: 260, icon: "creation", primary: "#2E1065", secondary: "#C084FC" },
    { id: "ice", name: "Лёд", price: 360, icon: "snowflake", primary: "#082F49", secondary: "#BAE6FD" },
  ],
  loops: [
    { id: "minimal", name: "Rose", price: 0, icon: "infinity", primary: "#96545A", secondary: "#E8D4D4" },
    { id: "neon", name: "Neon", price: 120, icon: "infinity", primary: "#FF343F", secondary: "#34050A" },
    { id: "ocean", name: "Green", price: 220, icon: "vector-curve", primary: "#6F8D35", secondary: "#E8F0D8" },
    { id: "galaxy", name: "Galaxy", price: 340, icon: "atom", primary: "#C084FC", secondary: "#1E1638" },
  ],
  "brain-tricks": [
    { id: "bubble", name: "Bubble", price: 0, icon: "head-lightbulb", primary: "#A3E635", secondary: "#ECFCCB" },
    { id: "robo", name: "Robo", price: 100, icon: "robot", primary: "#38BDF8", secondary: "#E0F2FE" },
    { id: "owl", name: "Owl", price: 180, icon: "owl", primary: "#F59E0B", secondary: "#FEF3C7" },
    { id: "cosmic", name: "Cosmic", price: 280, icon: "creation", primary: "#8B5CF6", secondary: "#EDE9FE" },
    { id: "slime", name: "Slime", price: 380, icon: "flask", primary: "#22C55E", secondary: "#DCFCE7" },
  ],
};

const ARCADE_COSMETICS: GameCosmetic[] = [
  { id: "classic", name: "Original", price: 0, icon: "circle-slice-8", primary: "#087CFF", secondary: "#DDEEFF" },
  { id: "neon", name: "Neon", price: 160, icon: "lightning-bolt", primary: "#7C3AED", secondary: "#EDE9FE" },
  { id: "gold", name: "Gold", price: 320, icon: "crown", primary: "#D99A00", secondary: "#FEF3C7" },
];

export function cosmeticsFor(gameId: GameId): GameCosmetic[] {
  return GAME_COSMETICS[gameId] ?? ARCADE_COSMETICS;
}

export function cosmeticFor(gameId: GameId, cosmeticId: string): GameCosmetic {
  const cosmetics = cosmeticsFor(gameId);
  return cosmetics.find((item) => item.id === cosmeticId) ?? cosmetics[0]!;
}
