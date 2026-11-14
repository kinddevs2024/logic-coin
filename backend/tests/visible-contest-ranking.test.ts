import { expect, it } from "vitest";
import { percentContestPlan } from "../src/lib/percent-contest-plan.js";
import { visibleContestRanking } from "../src/lib/visible-contest-ranking.js";
it("shows partial participants without changing any eligible prize or podium rank", () => {
  const finishers = Array.from({length:1000},(_,i)=>({userId:String(i),totalCoins:1000-i,completedGamesCount:6,finishedAt:null}));
  const partial = {userId:"partial",totalCoins:999999,completedGamesCount:5,finishedAt:null};
  const standings=[partial,...finishers];
  const payouts=percentContestPlan(standings);
  const visible=visibleContestRanking(standings,payouts.ranked);
  expect(visible).toHaveLength(1001);
  expect(visible.slice(0,1000)).toEqual(payouts.ranked);
  expect(visible.at(-1)).toMatchObject({userId:"partial",cashUnits:0,rank:1001,totalCoins:999999});
  expect(visible.reduce((s,r)=>s+Math.round(r.cashUnits*10000),0)).toBe(8250000);
});
it("shows progress even before any participant qualifies for cash", () => {
  const partial={userId:"one-game",totalCoins:25,completedGamesCount:1,finishedAt:null};
  expect(visibleContestRanking([partial],[])).toMatchObject([{userId:"one-game",rank:1,cashUnits:0,totalCoins:25}]);
});
