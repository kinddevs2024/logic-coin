import { createElement } from "react";

import { BrainTrainingGame } from "./brain-training";
import { ColorStroopGame } from "./color-stroop";
import { FindLetterGame } from "./find-letter";
import { FindNumberGame } from "./find-number";
import { OneSecondGame } from "./one-second";
import { StrikeGame } from "./strike";
import type { ArcadeGameDefinition, ArcadeGameProps } from "./types";
import { VoltMatchGame } from "./volt-match";

export type { ArcadeGameAId, ArcadeGameDefinition, ArcadeGameProps, ArcadeGameResult, ArcadeGameSkin } from "./types";

function defineGame(definition: Omit<ArcadeGameDefinition, "render">): ArcadeGameDefinition {
  return { ...definition, render: (props: ArcadeGameProps = {}) => createElement(definition.component, props) };
}

export const gamesA = [
  defineGame({ id: "one-second", title: "1 Секунда", subtitle: "Внутренние часы", icon: "timer-outline", accent: "#7C6FFF", component: OneSecondGame }),
  defineGame({ id: "color-stroop", title: "Цвет", subtitle: "Stroop Challenge", icon: "color-palette-outline", accent: "#EAB308", component: ColorStroopGame }),
  defineGame({ id: "strike", title: "Удар", subtitle: "Timing is everything", icon: "radio-button-on-outline", accent: "#FF2D2D", component: StrikeGame }),
  defineGame({ id: "find-number", title: "Космос", subtitle: "Найди число", icon: "planet-outline", accent: "#00FFE0", component: FindNumberGame }),
  defineGame({ id: "brain-training", title: "Мозговой штурм", subtitle: "Математические пузыри", icon: "bulb-outline", accent: "#C8A96E", component: BrainTrainingGame }),
  defineGame({ id: "find-letter", title: "Найди букву", subtitle: "Двойной символ", icon: "text-outline", accent: "#38BDF8", component: FindLetterGame }),
  defineGame({ id: "volt-match", title: "VOLT Match", subtitle: "Speed of thought", icon: "flash-outline", accent: "#F5C842", component: VoltMatchGame }),
] as const satisfies readonly ArcadeGameDefinition[];

export const gamesAById = Object.fromEntries(gamesA.map((game) => [game.id, game])) as Record<(typeof gamesA)[number]["id"], (typeof gamesA)[number]>;

export { BrainTrainingGame, ColorStroopGame, FindLetterGame, FindNumberGame, OneSecondGame, StrikeGame, VoltMatchGame };
