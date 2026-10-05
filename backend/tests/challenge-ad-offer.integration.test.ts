import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/services/notification.service.js", () => ({ dispatchNotificationEvent: vi.fn() }));
vi.mock("../src/services/contest-progress.service.js", () => ({ invalidateContestProgress: vi.fn() }));
import { User } from "../src/models/User.js";
import { DailyChallengeSet } from "../src/models/DailyChallengeSet.js";
import { ChallengeAttempt } from "../src/models/ChallengeAttempt.js";
import { ChallengeAdReward } from "../src/models/ChallengeAdReward.js";
import { RewardedAdSession } from "../src/models/RewardedAdSession.js";
import { LedgerEntry } from "../src/models/LedgerEntry.js";
import { NotificationEvent } from "../src/models/NotificationEvent.js";
import { getChallengeAdOffer, requireChallengeAdOffer, CHALLENGE_AD_COOLDOWN_MS } from "../src/services/challenge-ad-offer.service.js";
import { startRewardedAdSession, claimRewardedAdCoins } from "../src/services/rewarded-ad-session.service.js";
import { processReferralSignupReward } from "../src/services/user.service.js";
import { creditReferralCashPrizeShare } from "../src/services/referral.service.js";
import { challengeDayKey } from "../src/services/daily-challenge.service.js";

const uri = process.env.QA_MONGODB_URI;
describe.skipIf(!uri)("challenge offers and discontinued signup reward, isolated database", () => {
  const userId = new Types.ObjectId(), inviter = new Types.ObjectId(), parent = new Types.ObjectId();
  const gameIds = Array.from({ length: 6 }, () => new Types.ObjectId());
  let setId: Types.ObjectId;
  beforeAll(async () => {
    if (!uri?.startsWith("mongodb://127.0.0.1:27938/")) throw Error("Isolated QA MongoDB required");
    await mongoose.connect(uri, { dbName: `logic_coin_qa_ad_offer_${Date.now()}` });
    await Promise.all([User.init(), DailyChallengeSet.init(), ChallengeAttempt.init(), ChallengeAdReward.init(), RewardedAdSession.init(), LedgerEntry.init(), NotificationEvent.init()]);
  });
  afterAll(async () => { await mongoose.disconnect(); });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), DailyChallengeSet.deleteMany({}), ChallengeAttempt.deleteMany({}), ChallengeAdReward.deleteMany({}), RewardedAdSession.deleteMany({}), LedgerEntry.deleteMany({}), NotificationEvent.deleteMany({})]);
    await User.create([
      { _id: userId, email: "qa-player@example.invalid", name: "QA Player", referralCode: "QAPLAYER", referredBy: inviter },
      { _id: inviter, email: "qa-inviter@example.invalid", name: "QA Inviter", referralCode: "QAINVITER", referredBy: parent },
      { _id: parent, email: "qa-parent@example.invalid", name: "QA Parent", referralCode: "QAPARENT" },
    ]);
    const set = await DailyChallengeSet.create({ dayKey: challengeDayKey(), timezone: "UTC", selectionSeed: "qa", gameIds, endsAt: new Date(Date.now() + 3600000) });
    setId = set._id;
  });
  const finish = (count = 6) => ChallengeAttempt.create(gameIds.slice(0, count).map((gameId, index) => ({ userId, gameId, dailyChallengeSetId: setId, gameKey: `qa-${index}`, dayKey: challengeDayKey(), mode: "challenge", status: "completed", startedAt: new Date(), completedAt: new Date() })));
  const verified = async () => {
    const ad = await startRewardedAdSession(userId, "navigation-frequency");
    // Simulates an SDK/provider-verified callback, not a production ad view.
    await RewardedAdSession.updateOne({ sessionId: ad.sessionId }, { $set: { status: "completed" } });
    return ad.sessionId;
  };
  it("requires all challenge games before offering or starting an ad", async () => {
    await finish(5);
    expect((await getChallengeAdOffer(userId)).eligible).toBe(false);
    await expect(startRewardedAdSession(userId, "navigation-frequency")).rejects.toMatchObject({ code: "challenge_ad_not_eligible" });
  });
  it("awards exactly 45 contest points once and enforces five minutes", async () => {
    await finish(); expect((await getChallengeAdOffer(userId)).available).toBe(true);
    const id = await verified();
    expect((await claimRewardedAdCoins({ userId, sessionId: id })).credited).toBe(45);
    expect((await claimRewardedAdCoins({ userId, sessionId: id })).credited).toBe(0);
    expect(await ChallengeAdReward.countDocuments({ userId })).toBe(1);
    expect((await User.findById(userId))!.coins.balance).toBe(0);
    const at = (await User.findById(userId))!.challengeAdAvailableAt!;
    expect(at.getTime() - Date.now()).toBeGreaterThan(CHALLENGE_AD_COOLDOWN_MS - 3000);
    expect((await getChallengeAdOffer(userId, new Date(at.getTime() - 1))).available).toBe(false);
    expect((await getChallengeAdOffer(userId, at)).available).toBe(true);
    await expect(verified()).rejects.toMatchObject({ code: "challenge_ad_cooldown" });
    await User.updateOne({ _id: userId }, { $set: { challengeAdAvailableAt: new Date(Date.now() - 1) } });
    expect((await claimRewardedAdCoins({ userId, sessionId: await verified() })).credited).toBe(45);
    expect(await ChallengeAdReward.countDocuments({ userId })).toBe(2);
  });
  it("does not award an unfinished video or consume cooldown", async () => {
    await finish(); const ad = await startRewardedAdSession(userId, "navigation-frequency");
    await expect(claimRewardedAdCoins({ userId, sessionId: ad.sessionId })).rejects.toMatchObject({ code: "rewarded_ad_not_verified" });
    expect((await getChallengeAdOffer(userId)).available).toBe(true);
  });
  it("serializes different verified sessions on the same account", async () => {
    await finish(); const ids = [await verified(), await verified()];
    const results = await Promise.allSettled(ids.map(sessionId => claimRewardedAdCoins({ userId, sessionId })));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await ChallengeAdReward.countDocuments({ userId })).toBe(1);
  });
  it("stops offers when the next challenge replaces the completed one", async () => {
    await finish(); const id = await verified();
    await DailyChallengeSet.updateOne({ _id: setId }, { $set: { gameIds: gameIds.map(() => new Types.ObjectId()) } });
    expect((await getChallengeAdOffer(userId)).eligible).toBe(false);
    await expect(claimRewardedAdCoins({ userId, sessionId: id })).rejects.toMatchObject({ code: "challenge_ad_not_eligible" });
    expect(await ChallengeAdReward.countDocuments({ userId })).toBe(0);
  });
  it("does not pay for signup; preserves attribution and 15%/5% cash-win shares", async () => {
    const tx = await mongoose.startSession();
    try {
      await tx.withTransaction(async () => { await processReferralSignupReward(userId, tx); });
      expect((await User.findById(inviter))!.wallet.availableUnits).toBe(0);
      expect(await LedgerEntry.countDocuments({})).toBe(0);
      expect(String((await User.findById(userId))!.referredBy)).toBe(String(inviter));
      await tx.withTransaction(async () => { await creditReferralCashPrizeShare({ winnerUserId: userId, winnerPrizeUnits: 100, dayKey: challengeDayKey(), sourceId: "qa-prize" }, tx); });
      expect((await User.findById(inviter))!.wallet.availableUnits).toBe(15);
      expect((await User.findById(parent))!.wallet.availableUnits).toBe(5);
    } finally { await tx.endSession(); }
  });
});
