import { describe, expect, it, vi } from "vitest";
import { runDailyCycleSteps } from "../src/lib/daily-cycle.js";
import { collectContestStandings } from "../src/services/contest.service.js";
import { ChallengeAttempt } from "../src/models/ChallengeAttempt.js";
import { ChallengeAdReward } from "../src/models/ChallengeAdReward.js";
import { CoinLedgerEntry } from "../src/models/CoinLedgerEntry.js";
import { Types } from "mongoose";

describe("daily rollover failure isolation", () => {
  it("publishes each new day even when settlement keeps failing", async () => {
    const publish = vi.fn().mockResolvedValue(null);
    const error = new Error("completedGamesCount exceeds six");
    const settle = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();
    for (let day = 0; day < 2; day++) await runDailyCycleSteps({ publish, settle, onError });
    expect(publish).toHaveBeenCalledTimes(2);
    expect(settle).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith("settlement", error);
  });
  it("still settles when publication fails", async () => {
    const settle = vi.fn().mockResolvedValue(null);
    const onError = vi.fn();
    const error = new Error("publication unavailable");
    await runDailyCycleSteps({ publish: async () => { throw error; }, settle, onError });
    expect(settle).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith("publication", error);
  });
  it("caps historical seven-game results at six without losing earned coins", async () => {
    const userId = new Types.ObjectId();
    const find = vi.spyOn(ChallengeAttempt, "find").mockReturnValue({ select: () => ({ lean: async () => Array.from({ length: 7 }, () => ({ userId, gameId: new Types.ObjectId(), completedAt: new Date("2026-10-29T12:00:00Z") })) }) } as never);
    const ads = vi.spyOn(ChallengeAdReward, "find").mockReturnValue({ lean: async () => [] } as never);
    const coins = vi.spyOn(CoinLedgerEntry, "aggregate").mockResolvedValue([{ _id: userId, totalCoins: 7123 }]);
    try {
      const standings = await collectContestStandings("2026-10-29");
      expect(standings).toEqual([{ userId: userId.toString(), totalCoins: 7123, completedGamesCount: 6, finishedAt: "2026-10-29T12:00:00.000Z" }]);
    } finally { find.mockRestore(); ads.mockRestore(); coins.mockRestore(); }
  });
});
