import { createElement, type ReactElement } from "react";

import { GeographyQuizGame } from "./geography-quiz";
import { GAME_B_ICONS } from "./icons";
import { MathDuelGame } from "./math-duel";
import { MathQuizGame } from "./math-quiz";
import { PulseGame } from "./pulse";
import { ShadowMatchGame } from "./shadow-match";
import type { ArcadeGameDefinition, ArcadeGameProps, GameBId } from "./types";
import { VoltNumbersGame } from "./volt-numbers";

function defineGame(definition: Omit<ArcadeGameDefinition, "render">): ArcadeGameDefinition {
  return {
    ...definition,
    render: (props) => createElement(definition.component, props),
  };
}

export const gamesB = [
  defineGame({ id: "geo-master", title: "Гео Мастер", subtitle: "12 вопросов о мире", icon: GAME_B_ICONS.geography, accent: "#2EE8FF", category: "logic", component: GeographyQuizGame }),
  defineGame({ id: "pulse", title: "Pulse", subtitle: "Цепная реакция", icon: GAME_B_ICONS.pulse, accent: "#A879FF", category: "logic", component: PulseGame }),
  defineGame({ id: "volt-numbers", title: "VOLT Numbers", subtitle: "Скорость поиска", icon: GAME_B_ICONS.voltNumbers, accent: "#FFD85A", category: "speed", component: VoltNumbersGame }),
  defineGame({ id: "math-quiz", title: "Матем", subtitle: "15 быстрых примеров", icon: GAME_B_ICONS.mathQuiz, accent: "#FFD85A", category: "math", component: MathQuizGame }),
  defineGame({ id: "math-duel", title: "Дуэль Умов", subtitle: "Два поля одновременно", icon: GAME_B_ICONS.mathDuel, accent: "#A879FF", category: "math", component: MathDuelGame }),
  defineGame({ id: "shadow-match", title: "Тень", subtitle: "Запомни и найди", icon: GAME_B_ICONS.shadowMatch, accent: "#4EF2A3", category: "memory", component: ShadowMatchGame }),
] as const satisfies readonly ArcadeGameDefinition[];

export const gamesBById: Readonly<Record<GameBId, ArcadeGameDefinition>> = Object.fromEntries(
  gamesB.map((game) => [game.id, game]),
) as Record<GameBId, ArcadeGameDefinition>;

export function renderGameB(gameId: GameBId, props: ArcadeGameProps): ReactElement {
  return gamesBById[gameId].render(props);
}

export { GeographyQuizGame } from "./geography-quiz";
export { MathDuelGame } from "./math-duel";
export { MathQuizGame } from "./math-quiz";
export { PulseGame } from "./pulse";
export { ShadowMatchGame } from "./shadow-match";
export { VoltNumbersGame } from "./volt-numbers";
export type { ArcadeGameDefinition, ArcadeGameProps, ArcadeGameResult, ArcadeGameSkin, GameBId } from "./types";
