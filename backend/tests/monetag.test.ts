import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/config/env.js", () => ({ env: { MONETAG_POSTBACK_SECRET: "a".repeat(64), NODE_ENV: "test", YANDEX_ALLOW_CLIENT_CALLBACK: true, APPODEAL_ALLOW_CLIENT_CALLBACK: true } }));
import { Types } from "mongoose";
import { RewardedAdSession } from "../src/models/RewardedAdSession.js";
import { verifyMonetagPostback } from "../src/services/monetag.service.js";
import { completeRewardedAdFromClient } from "../src/services/rewarded-ad-session.service.js";
const sessionId = "aaaabbbb-1111-4222-8333-444455556666";
const valid = { secret: "a".repeat(64), ymid: sessionId, zone_id: "12150927", event_type: "impression" as const, reward_event_type: "valued" as const };
describe("Monetag server-confirmed rewards", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("rejects a missing or wrong credential before database access", async () => {
    const update = vi.spyOn(RewardedAdSession, "findOneAndUpdate");
    await expect(verifyMonetagPostback({ ...valid, secret: "wrong" })).rejects.toMatchObject({ statusCode: 403 });
    expect(update).not.toHaveBeenCalled();
  });
  it("rejects another zone", async () => {
    await expect(verifyMonetagPostback({ ...valid, zone_id: "12150928" })).rejects.toMatchObject({ statusCode: 400 });
  });
  it("does not reward non-valued events or an uncorrelated impression", async () => {
    const update = vi.spyOn(RewardedAdSession, "findOneAndUpdate");
    expect(await verifyMonetagPostback({ ...valid, reward_event_type: "non_valued" })).toEqual({ accepted: false });
    expect(await verifyMonetagPostback({ ...valid, ymid: "interstitial-free-show" })).toEqual({ accepted: false });
    expect(update).not.toHaveBeenCalled();
  });
  it("matches an unexpired Monetag session and requires BOTH confirmations atomically", async () => {
    const update = vi.spyOn(RewardedAdSession, "findOneAndUpdate").mockResolvedValueOnce({ sessionId } as never).mockResolvedValueOnce(null);
    expect(await verifyMonetagPostback(valid)).toEqual({ accepted: true });
    expect(update.mock.calls[0]?.[0]).toMatchObject({ sessionId, provider: "monetag", status: "started", expiresAt: { $gt: expect.any(Date) } });
    expect(update.mock.calls[1]?.[0]).toMatchObject({ clientReceiptId: { $type: "string" }, monetagValuedAt: { $type: "date" }, status: "started" });
  });
  it("ignores a repeat delivery or an expired/foreign session without another reward", async () => {
    const update = vi.spyOn(RewardedAdSession, "findOneAndUpdate").mockResolvedValue(null);
    expect(await verifyMonetagPostback(valid)).toEqual({ accepted: false });
    expect(update).toHaveBeenCalledOnce();
  });
  it("never trusts client-only Monetag completion even when native client callbacks are allowed", async () => {
    const session = { sessionId, userId: new Types.ObjectId(), provider: "monetag", placement: "home-gift", status: "started", rewardCoins: 0, expiresAt: new Date(Date.now()+60000), save: vi.fn() };
    vi.spyOn(RewardedAdSession, "findOne").mockResolvedValue(session as never);
    vi.spyOn(RewardedAdSession, "findOneAndUpdate").mockResolvedValue(null);
    const result = await completeRewardedAdFromClient({ userId: session.userId, sessionId, clientReceiptId: "monetag-client-proof-1234" });
    expect(result.status).toBe("started"); expect(session.save).toHaveBeenCalledOnce();
  });
});
