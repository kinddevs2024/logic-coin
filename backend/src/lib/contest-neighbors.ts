import { type ContestStandingInput } from "./contest.js";
import { contestPrizePlan, type ManualCashPrize } from "./manual-contest-prizes.js";

export function contestNeighborhood(standings: ContestStandingInput[], userId: string, minUnits: number, maxUnits: number, budget: number, manualCashPrizes?: readonly ManualCashPrize[] | null) {
  const plan = contestPrizePlan(standings, { cashPrizeMinUnits: minUnits, cashPrizeMaxUnits: maxUnits, prizePoolUnits: budget, ...(manualCashPrizes !== undefined ? { manualCashPrizes } : {}) });
  const ranked = plan.ranked;
  const index = ranked.findIndex(row => row.userId === userId);
  const self = ranked[index] ?? null;
  // At the top/bottom there may be fewer neighbours; never invent participants.
  const start = Math.max(0, index - 2);
  return {
    participantCount: ranked.length,
    self,
    projectedCashUnits: self ? plan.ladder[self.rank - 1] ?? 0 : 0,
    neighbors: ranked.slice(start, index < 0 ? 5 : Math.max(5, index + 3)),
  };
}
