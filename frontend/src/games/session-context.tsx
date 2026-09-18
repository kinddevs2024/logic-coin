import { createContext, useContext } from "react";

export type GameSessionControls = {
  onStart: () => void;
  onExit: () => void;
  paused: boolean;
};

export const GameSessionContext = createContext<GameSessionControls | null>(null);
export const useGameSession = () => useContext(GameSessionContext);
