import mongoose, { Types } from "mongoose";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { User } from "../src/models/User.js";
import { GiftItem } from "../src/models/GiftItem.js";
import { DailyContestResult } from "../src/models/DailyContestResult.js";
import { NotificationEvent } from "../src/models/NotificationEvent.js";
import { NotificationRead } from "../src/models/NotificationRead.js";
import { countUnreadInbox, listInbox, markAllInboxRead, markInboxRead } from "../src/services/inbox.service.js";
import notifications from "../src/routes/notifications.routes.js";

const uri = process.env.QA_MONGODB_URI;
describe.skipIf(!uri)("read complete inbox, isolated MongoDB", () => {
  const userId = new Types.ObjectId(), otherId = new Types.ObjectId();
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.auth = { userId, sessionId: String(new Types.ObjectId()) }; next(); });
  app.use("/notifications", notifications);
  const past = new Date(Date.now() - 60_000);
  beforeAll(async () => {
    if (!uri?.startsWith("mongodb://127.0.0.1:27938/")) throw Error("Only isolated QA MongoDB is permitted");
    await mongoose.connect(uri, { dbName: `logic_coin_qa_inbox_${Date.now()}` });
    await Promise.all([User.init(), GiftItem.init(), DailyContestResult.init(), NotificationEvent.init(), NotificationRead.init()]);
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), GiftItem.deleteMany({}), DailyContestResult.deleteMany({}), NotificationEvent.deleteMany({}), NotificationRead.deleteMany({})]);
    await User.create([
      { _id: userId, email: "inbox@example.invalid", name: "Inbox QA", referralCode: "INBOXQA1", createdAt: new Date(+past - 60_000) },
      { _id: otherId, email: "other-inbox@example.invalid", name: "Other QA", referralCode: "INBOXQA2", createdAt: new Date(+past - 60_000) },
    ]);
    await NotificationEvent.create(Array.from({ length: 43 }, (_, index) => ({ eventKey: `qa-all-${index}`, type: "admin_broadcast", audience: "all_users", payload: { title: `Notice ${index}`, body: "QA" }, createdAt: past })));
  });
  afterAll(async () => { await mongoose.disconnect(); });

  it("marks all 43 entries, including unloaded pages, only for this user", async () => {
    expect((await listInbox(userId, true)).items).toHaveLength(10);
    expect(await countUnreadInbox(userId)).toBe(43);
    const response = await request(app).post("/notifications/read-all").send({});
    expect(response.status).toBe(200);
    expect(Number.isFinite(Date.parse(response.body.data.readThrough))).toBe(true);
    expect(await countUnreadInbox(userId)).toBe(0);
    expect((await listInbox(userId, true)).items.every(item => item.read)).toBe(true);
    expect(await countUnreadInbox(otherId)).toBe(43);
    expect(await NotificationEvent.countDocuments()).toBe(43);
  });

  it("also covers gifts and results while respecting private audiences", async () => {
    await GiftItem.create({ userId, kind: "extra_time", amountSeconds: 45, sourceId: "qa-gift", description: "+45 seconds", createdAt: past });
    await DailyContestResult.create({ userId, dayKey: "2026-10-17", totalCoins: 10, completedGamesCount: 1, rank: 1, rewardType: "coins", settledAt: past });
    await NotificationEvent.create({ eventKey: "qa-private", type: "admin_broadcast", audience: "specific_users", payload: { userIds: [String(otherId)], title: "Private" }, createdAt: past });
    expect(await countUnreadInbox(userId)).toBe(45);
    await markAllInboxRead(userId);
    expect(await countUnreadInbox(userId)).toBe(0);
    expect(await countUnreadInbox(otherId)).toBe(44);
  });

  it("keeps later notifications unread, and individual reads still work", async () => {
    const { readThrough } = await markAllInboxRead(userId);
    const event = await NotificationEvent.create({ eventKey: "qa-later", type: "admin_broadcast", audience: "all_users", payload: { title: "New" }, createdAt: new Date(Date.parse(readThrough) + 1000) });
    expect(await countUnreadInbox(userId)).toBe(1);
    await markInboxRead(userId, [`event:${event._id}`]);
    expect(await countUnreadInbox(userId)).toBe(0);
    expect(await countUnreadInbox(otherId)).toBe(44);
  });

  it("repeated and concurrent requests cannot move the read cutoff backwards", async () => {
    await Promise.all([markAllInboxRead(userId), markAllInboxRead(userId)]);
    const future = new Date(Date.now() + 60_000);
    await User.updateOne({ _id: userId }, { $set: { inboxReadThrough: future } });
    expect((await markAllInboxRead(userId)).readThrough).toBe(future.toISOString());
    expect(await countUnreadInbox(userId)).toBe(0);
  });
});
