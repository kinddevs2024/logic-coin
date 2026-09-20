import { beforeEach, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { challengeAdRewardDay } from "../src/lib/challenge-ad-reward.js";

const mocks = vi.hoisted(() => ({
  findAd: vi.fn(), findSet: vi.fn(), createBonus: vi.fn(), previousBonus: vi.fn(),
  creditCoins: vi.fn(), balance: vi.fn(), end: vi.fn(),
}));
vi.mock("mongoose", async importOriginal => {
  const actual = await importOriginal<typeof import("mongoose")>();
  return { ...actual, models: actual.default.models, model: actual.default.model, default: { ...actual.default, startSession: async () => ({ withTransaction: async (fn: () => Promise<void>) => fn(), endSession: mocks.end }) } };
});
vi.mock("../src/models/RewardedAdSession.js", () => ({ REWARDED_AD_PLACEMENTS: [], RewardedAdSession: { findOne: () => ({ session: mocks.findAd }) } }));
vi.mock("../src/models/DailyChallengeSet.js", () => ({ DailyChallengeSet: { findOne: () => ({ session: mocks.findSet }) } }));
vi.mock("../src/models/ChallengeAdReward.js", () => ({ ChallengeAdReward: { create: mocks.createBonus, findOne: () => ({ session: mocks.previousBonus }) } }));
vi.mock("../src/services/coin.service.js", () => ({ creditCoins: mocks.creditCoins, getCoinBalance: mocks.balance }));
vi.mock("../src/services/daily-challenge.service.js", () => ({ challengeDayKey: () => "2026-09-20" }));
vi.mock("../src/services/contest-progress.service.js", () => ({ invalidateContestProgress: vi.fn() }));
import { claimRewardedAdCoins } from "../src/services/rewarded-ad-session.service.js";

const userId = new Types.ObjectId();
const ad = () => ({ userId, sessionId: "verified-ad", provider: "appodeal", placement: "navigation-frequency", status: "completed", rewardCoins: 45, expiresAt: new Date(Date.now() + 60_000), save: vi.fn() });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findAd.mockResolvedValue(ad());
  mocks.findSet.mockResolvedValue({ status: "published", endsAt: new Date(Date.now() + 60_000) });
  mocks.balance.mockResolvedValue({ balance: 100, lifetimeEarned: 100 });
});
it("puts 45 into the active contest and never calls the global wallet credit", async () => {
  const result = await claimRewardedAdCoins({ userId, sessionId: "verified-ad" });
  expect(result).toMatchObject({ credited: 45, challengeDayKey: "2026-09-20", coins: { balance: 100, lifetimeEarned: 100 } });
  expect(mocks.createBonus).toHaveBeenCalledWith([expect.objectContaining({ amount: 45, dayKey: "2026-09-20", userId })], expect.anything());
  expect(mocks.creditCoins).not.toHaveBeenCalled();
});
it("reserves points for tomorrow when today's contest has ended", async () => {
  mocks.findSet.mockResolvedValue({ status: "settled" });
  const result = await claimRewardedAdCoins({ userId, sessionId: "verified-ad" });
  expect(result.challengeDayKey).toBe("2026-09-21");
  expect(mocks.creditCoins).not.toHaveBeenCalled();
});
it("does not double credit a retried claim", async () => {
  mocks.findAd.mockResolvedValue({ ...ad(), status: "claimed" });
  mocks.previousBonus.mockResolvedValue({ dayKey: "2026-09-20" });
  expect(await claimRewardedAdCoins({ userId, sessionId: "verified-ad" })).toMatchObject({ credited: 0, idempotentReplay: true });
  expect(mocks.createBonus).not.toHaveBeenCalled();
  expect(mocks.creditCoins).not.toHaveBeenCalled();
});
it("rejects an unverified video", async () => {
  mocks.findAd.mockResolvedValue({ ...ad(), status: "started" });
  await expect(claimRewardedAdCoins({ userId, sessionId: "verified-ad" })).rejects.toMatchObject({ code: "rewarded_ad_not_verified" });
  expect(mocks.createBonus).not.toHaveBeenCalled();
});
it("keeps other ad placements on the existing wallet path", async () => {
  mocks.findAd.mockResolvedValue({ ...ad(), placement: "challenge-third-game", rewardCoins: 75 });
  mocks.creditCoins.mockResolvedValue({ idempotentReplay: false });
  expect(await claimRewardedAdCoins({ userId, sessionId: "verified-ad" })).toMatchObject({ credited: 75, challengeDayKey: null });
  expect(mocks.creditCoins).toHaveBeenCalled();
  expect(mocks.createBonus).not.toHaveBeenCalled();
});
it("uses an exclusive deadline and handles calendar boundaries", () => {
  const now = new Date("2026-12-31T23:59:59Z");
  expect(challengeAdRewardDay("2026-12-31", { status: "published", endsAt: now }, now)).toBe("2027-01-01");
  expect(challengeAdRewardDay("2026-09-20", null, now)).toBe("2026-09-21");
  expect(challengeAdRewardDay("2026-09-20", { status: "draft" }, now)).toBe("2026-09-21");
});
