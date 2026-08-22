import type { ComponentType, ReactElement } from "react";

export type ArcadeGameAId =
  | "one-second"
  | "color-stroop"
  | "strike"
  | "find-number"
  | "brain-training"
  | "find-letter"
  | "volt-match";

export type ArcadeGameResult = {
  gameId: ArcadeGameAId;
  score: number;
  won: boolean;
  durationMs: number;
  suggestedCoins: number;
  stats: Record<string, number | string | boolean>;
};

export type ArcadeGameSkin = {
  id: string;
  primary: string;
  secondary: string;
};

export type ArcadeGameProps = {
  initialBestScore?: number;
  /** Session-scoped time bonus. A host may remount with a new sessionKey after consuming a gift. */
  extraTimeSeconds?: number;
  challengeMode?: boolean;
  attemptLimit?: number;
  sessionKey?: string;
  /** The cosmetic selected in the host. `classic` preserves the game's original art direction. */
  skin?: ArcadeGameSkin;
  onExit?: () => void;
  onComplete?: (result: ArcadeGameResult) => void;
};

export type ArcadeGameDefinition = {
  id: ArcadeGameAId;
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
  component: ComponentType<ArcadeGameProps>;
  render: (props?: ArcadeGameProps) => ReactElement;
};
