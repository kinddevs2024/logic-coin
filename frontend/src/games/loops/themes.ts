export type LoopTheme = {
  id: string;
  name: string;
  rarity: "Обычная" | "Редкая" | "Эпическая";
  unlockLevel: number;
  background: string;
  surface: string;
  line: string;
  glow: string;
  node: string;
};

export const LOOP_THEMES: LoopTheme[] = [
  { id: "minimal", name: "Minimal", rarity: "Обычная", unlockLevel: 1, background: "#E7CFCF", surface: "#E9D4D3", line: "#9B5256", glow: "#C8797C", node: "#8D4449" },
  { id: "neon", name: "Neon Circuit", rarity: "Редкая", unlockLevel: 10, background: "#071B2B", surface: "#0B2538", line: "#43F4FF", glow: "#28B9FF", node: "#C9FCFF" },
  { id: "ocean", name: "Ocean Flow", rarity: "Редкая", unlockLevel: 20, background: "#CDEFF1", surface: "#BCE5EA", line: "#147C93", glow: "#58D3E1", node: "#07566C" },
  { id: "galaxy", name: "Galaxy Network", rarity: "Эпическая", unlockLevel: 30, background: "#17122E", surface: "#211943", line: "#C894FF", glow: "#6CF4FF", node: "#F6DDFF" },
];

