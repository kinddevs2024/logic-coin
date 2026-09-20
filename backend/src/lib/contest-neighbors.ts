import { computeContestBands, interpolateCashPrize, rankContestStandings, type ContestStandingInput } from "./contest.js";
import { CONTEST_CASH_TOP_PERCENT, CONTEST_CASE_PERCENT, CONTEST_RANDOM_PERCENT } from "../config/constants.js";

export function contestNeighborhood(standings: ContestStandingInput[], userId: string, minUnits: number, maxUnits: number) {
  const bands = computeContestBands(standings.length, CONTEST_CASH_TOP_PERCENT, CONTEST_CASE_PERCENT, CONTEST_RANDOM_PERCENT);
  const ranked = rankContestStandings(standings, bands);
  const index = ranked.findIndex(row => row.userId === userId);
  const self = ranked[index] ?? null;
  // At the top/bottom there may be fewer neighbours; never invent participants.
  const start = Math.max(0, index - 2);
  return {
    participantCount: ranked.length,
    self,
    projectedCashUnits: self?.rewardType === "cash" ? interpolateCashPrize(self.rank, bands.cashWinners, minUnits, maxUnits) : 0,
    neighbors: ranked.slice(start, index < 0 ? 5 : Math.max(5, index + 3)),
  };
}
