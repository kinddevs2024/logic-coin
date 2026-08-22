import { describe, expect, it } from "vitest";
import {
  buildCashPrizeLadder,
  computeContestBands,
  contestGiftKindForIndex,
  rankContestStandings
} from "../src/lib/contest.js";
import { pickSeededSubset } from "../src/lib/seeded-random.js";
import { challengeCoinsForScore } from "../src/services/challenge-attempt.service.js";
import { calculateReferralPrizeShare } from "../src/services/referral.service.js";

describe("daily challenge selection", () => {
  const games = Array.from({ length: 21 }, (_, index) => `game-${index}`);

  it("selects six unique games deterministically for a day", () => {
    const first = pickSeededSubset(games, 6, "daily-challenge:2026-08-20");
    const second = pickSeededSubset(games, 6, "daily-challenge:2026-08-20");
    expect(first).toEqual(second);
    expect(first).toHaveLength(6);
    expect(new Set(first).size).toBe(6);
  });
});

describe("challenge coin rules", () => {
  it("caps one game at 1000 coins while preserving the raw score contract", () => {
    expect(challengeCoinsForScore(0)).toBe(25);
    expect(challengeCoinsForScore(499)).toBe(49);
    expect(challengeCoinsForScore(50_000)).toBe(1_000);
  });

  it("calculates a 25 percent referral prize share in integer units", () => {
    expect(calculateReferralPrizeShare(10_000)).toBe(2_500);
    expect(calculateReferralPrizeShare(3)).toBe(0);
  });
});

describe("contest settlement rules", () => {
  it("rotates the middle reward band through extra time, replay, and coin gifts", () => {
    expect(Array.from({ length: 6 }, (_, index) => contestGiftKindForIndex(index))).toEqual([
      "extra_time",
      "replay",
      "coin",
      "extra_time",
      "replay",
      "coin"
    ]);
  });

  it("splits 100 participants into 10 percent cash, 45 percent cases, and the rest coins", () => {
    expect(computeContestBands(100)).toEqual({
      participantCount: 100,
      cashWinners: 10,
      caseWinners: 45,
      coinWinners: 45
    });
  });

  it("uses cumulative percentile boundaries for small cohorts", () => {
    expect(computeContestBands(3)).toEqual({
      participantCount: 3,
      cashWinners: 1,
      caseWinners: 1,
      coinWinners: 1
    });
  });

  it("builds a monotonic cash ladder with exact max and min endpoints", () => {
    const ladder = buildCashPrizeLadder(10, 500, 10_000);
    expect(ladder[0]).toBe(10_000);
    expect(ladder[9]).toBe(500);
    for (let index = 1; index < ladder.length; index += 1) {
      expect(ladder[index]!).toBeLessThanOrEqual(ladder[index - 1]!);
    }
  });

  it("ranks by coins, completed games, then earliest finish", () => {
    const bands = computeContestBands(3);
    const ranked = rankContestStandings(
      [
        { userId: "a", totalCoins: 900, completedGamesCount: 5, finishedAt: "2026-08-20T10:00:00Z" },
        { userId: "b", totalCoins: 900, completedGamesCount: 6, finishedAt: "2026-08-20T11:00:00Z" },
        { userId: "c", totalCoins: 900, completedGamesCount: 6, finishedAt: "2026-08-20T09:00:00Z" }
      ],
      bands
    );
    expect(ranked.map((entry) => entry.userId)).toEqual(["c", "b", "a"]);
    expect(ranked[0]?.rewardType).toBe("cash");
  });
});
