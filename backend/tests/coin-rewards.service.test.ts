import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
const mocks = vi.hoisted(() => ({ claims: [] as { sourceId: string }[], days: [] as { _id: string }[], credit: vi.fn(), balance: vi.fn() }));
vi.mock("../src/models/CoinRewardLogin.js", () => ({ CoinRewardLogin: {
  findById: () => ({ lean: async () => ({ dayKey: "2026-10-10", slot: 1 }) }),
  findOne: () => ({ sort: () => ({ lean: async () => ({ dayKey: "2026-10-10" }) }) }),
} }));
vi.mock("../src/models/ChallengeAttempt.js", () => ({ ChallengeAttempt: { aggregate: async () => mocks.days } }));
vi.mock("../src/models/CoinLedgerEntry.js", () => ({ CoinLedgerEntry: { find: () => ({ select: () => ({ lean: async () => mocks.claims }) }) } }));
vi.mock("../src/services/coin.service.js", () => ({ creditCoins: mocks.credit, getCoinBalance: mocks.balance }));
import { claimCoinReward } from "../src/services/coin-rewards.service.js";
describe("coin gift claims", () => {
  beforeEach(() => { mocks.claims = []; mocks.days = []; mocks.credit.mockReset().mockResolvedValue({ idempotentReplay: false }); mocks.balance.mockReset().mockResolvedValue({ balance: 100 }); });
  it("uses server amount and daily source key rather than client supplied values", async () => {
    const user = new Types.ObjectId();
    expect((await claimCoinReward(user, "daily")).credited).toBe(100);
    expect(mocks.credit).toHaveBeenCalledWith(expect.objectContaining({ userId: user, amount: 100, sourceId: "attendance:daily:2026-10-10", type: "attendance_coin_reward" }));
  });
  it("blocks a second claim before any wallet write", async () => {
    mocks.claims = [{ sourceId: "attendance:daily:2026-10-10" }];
    await expect(claimCoinReward(new Types.ObjectId(), "daily")).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.credit).not.toHaveBeenCalled();
  });
  it("does not pay locked weekly or monthly rewards", async () => {
    await expect(claimCoinReward(new Types.ObjectId(), "week")).rejects.toThrow();
    await expect(claimCoinReward(new Types.ObjectId(), "month")).rejects.toThrow();
    expect(mocks.credit).not.toHaveBeenCalled();
  });
  it("reports zero rather than a second reward on an idempotent transaction replay", async () => {
    mocks.credit.mockResolvedValue({ idempotentReplay: true });
    expect((await claimCoinReward(new Types.ObjectId(), "daily")).credited).toBe(0);
  });
});
