import { rankContestStandings, type ContestStandingInput } from "./contest.js";

// Eligibility controls money, not whether a participant can see their progress.
export function visibleContestRanking<T extends ContestStandingInput & { rank: number; cashUnits: number }>(standings: readonly ContestStandingInput[], paid: readonly T[]) {
  const included = new Set(paid.map(row => row.userId));
  const partial = standings.filter(row => !included.has(row.userId));
  const remaining = rankContestStandings(partial, { participantCount: partial.length, cashWinners: 0, caseWinners: 0, randomWinners: 0, coinWinners: partial.length });
  return [...paid, ...remaining.map((row, i) => ({ ...row, rank: paid.length + i + 1, cashUnits: 0 }))];
}
