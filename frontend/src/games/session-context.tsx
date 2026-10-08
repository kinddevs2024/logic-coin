import { createContext, useContext, type ReactNode } from "react";

export type GameSessionControls = {
  onStart: () => void;
  onExit: () => void;
  paused: boolean;
  practiceCoins?: number;
  gameKey?: string;
  headerAction?: ReactNode;
};

export const GameSessionContext = createContext<GameSessionControls | null>(null);
export const useGameSession = () => useContext(GameSessionContext);
