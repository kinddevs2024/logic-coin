import type { ComponentType, ReactElement } from "react";

import type { ArcadeIconName } from "./icons";

export type GameBId =
  | "geo-master"
  | "pulse"
  | "volt-numbers"
  | "math-quiz"
  | "math-duel"
  | "shadow-match";

export type ArcadeGameResult = {
  gameId: GameBId;
  score: number;
  coins: number;
  won: boolean;
  durationMs: number;
  details?: Record<string, number | string | boolean>;
};

export type ArcadeGameSkin = {
  id: string;
  primary: string;
  secondary: string;
};

export type ArcadeGameProps = {
  onExit?: () => void;
  onFinish?: (result: ArcadeGameResult) => void;
  initialBest?: number;
  initialCoins?: number;
  /** Session-scoped time bonus supplied by the host after a gift is consumed. */
  extraTimeSeconds?: number;
  /** Cosmetic palette selected by the host for this game. */
  skin?: ArcadeGameSkin;
};

export type ArcadeGameDefinition = {
  id: GameBId;
  title: string;
  subtitle: string;
  icon: ArcadeIconName;
  accent: string;
  category: "logic" | "memory" | "speed" | "math";
  component: ComponentType<ArcadeGameProps>;
  render: (props: ArcadeGameProps) => ReactElement;
};
