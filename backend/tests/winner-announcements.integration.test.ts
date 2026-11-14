import mongoose, { Types } from "mongoose";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const ids = vi.hoisted(() => ({ admin: "507f1f77bcf86cd799439011", user: "507f1f77bcf86cd799439012" }));
vi.mock("../src/services/token.service.js", () => ({ verifyAccessToken: (token: string) => ({ sub: token === "admin" ? ids.admin : ids.user, sid: "507f1f77bcf86cd799439013" }), isAccessSessionActive: async () => true }));
vi.mock("../src/services/live-updates.service.js", () => ({ notifyChatChange: vi.fn() }));
import { User } from "../src/models/User.js";
import { ChatConversation, ChatMessage, ChatMember } from "../src/models/Chat.js";
import { WinnerAnnouncement } from "../src/models/WinnerAnnouncement.js";
import routes from "../src/routes/admin-winner-announcements.routes.js";
import { publishWinnerAnnouncement } from "../src/services/winner-announcements.service.js";
import { listMessages, changeMessage } from "../src/services/chat.service.js";
import { notifyChatChange } from "../src/services/live-updates.service.js";
const uri = process.env.QA_MONGODB_URI;
describe.skipIf(!uri)("manual winner announcements, isolated database", () => {
  const adminId = new Types.ObjectId(ids.admin), userId = new Types.ObjectId(ids.user);
  const app = express(); app.use(express.json()); app.use("/announcements", routes);
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(error.statusCode ?? 500).json({ error: { code: error.code, message: error.message } }); });
  const draft = () => ({ operationId: randomUUID(), recipientId: String(userId), raffleTitle: "Еженедельный розыгрыш", prizeType: "cash" as const, amountCents: 525 });
  beforeAll(async () => {
    if (!uri?.startsWith("mongodb://127.0.0.1:27938/")) throw Error("Isolated QA MongoDB required");
    await mongoose.connect(uri, { dbName: `logic_coin_qa_winner_posts_${Date.now()}` });
    await Promise.all([User.init(), ChatConversation.init(), ChatMessage.init(), ChatMember.init(), WinnerAnnouncement.init()]);
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([User.deleteMany({}), ChatConversation.deleteMany({}), ChatMessage.deleteMany({}), ChatMember.deleteMany({}), WinnerAnnouncement.deleteMany({})]);
    await User.create([{ _id: adminId, name: "QA Admin", email: "admin@example.invalid", referralCode: "WINADMIN", role: "admin" }, { _id: userId, name: "QA Winner", username: "winner", email: "winner@example.invalid", referralCode: "WINUSER", wallet: { availableUnits: 123400 } }]);
  });
  afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  it("publishes senderless posts in both official feeds and preserves the wallet", async () => {
    const response = await request(app).post("/announcements").set("Authorization", "Bearer admin").send(draft()).expect(200);
    expect(response.body.data.replay).toBe(false);
    expect(response.body.data.announcement.destinations.map((x: any) => x.systemKey).sort()).toEqual(["community", "news"]);
    expect(await WinnerAnnouncement.countDocuments({})).toBe(1);
    const posts = await ChatMessage.find().lean(); expect(posts).toHaveLength(2);
    for (const post of posts) {
      expect(post.senderId).toBeUndefined(); expect(post.system).toMatchObject({ kind: "raffle_winner", recipientName: "QA Winner", amountCents: 525, raffleTitle: "Еженедельный розыгрыш" });
      const serialized = await listMessages(userId, String(adminId), String(post.conversationId));
      expect(serialized.items[0]).toMatchObject({ own: false, system: { recipientId: String(userId), amountCents: 525, raffleTitle: "Еженедельный розыгрыш" } });
    }
    expect((await User.findById(userId))!.wallet.availableUnits).toBe(123400);
    expect(notifyChatChange).toHaveBeenCalledTimes(2);
    const history = await request(app).get("/announcements").set("Authorization", "Bearer admin").expect(200);
    expect(history.headers["cache-control"]).toBe("no-store"); expect(history.body.data.items).toHaveLength(1);
    expect((await WinnerAnnouncement.findOne())!.createdBy.toString()).toBe(String(adminId));
  });
  it("supports a physical prize without a fabricated cash amount", async () => {
    const { amountCents, ...base } = draft();
    await publishWinnerAnnouncement({ ...base, prizeType: "item", prizeText: "iPhone" }, adminId);
    const post = (await ChatMessage.findOne())!;
    expect(post.system!.prizeText).toBe("iPhone"); expect(post.system!.amountCents).toBeUndefined();
    const result = await listMessages(userId, String(adminId), String(post.conversationId));
    expect(result.items[0]!.system).toMatchObject({ prizeText: "iPhone", raffleTitle: base.raffleTitle });
    expect(result.items[0]!.system).not.toHaveProperty("amountCents");
  });
  it("retries and concurrent double clicks produce only one pair of posts", async () => {
    const input = draft();
    const results = await Promise.all([publishWinnerAnnouncement(input, adminId), publishWinnerAnnouncement(input, adminId)]);
    expect(results.map(x => x.announcement.id)[0]).toBe(results[1]!.announcement.id);
    expect(await ChatMessage.countDocuments({})).toBe(2); expect(await WinnerAnnouncement.countDocuments({})).toBe(1);
    expect((await publishWinnerAnnouncement(input, adminId)).replay).toBe(true);
    await expect(publishWinnerAnnouncement({ ...input, amountCents: 600 }, adminId)).rejects.toMatchObject({ statusCode: 409 });
    expect(await ChatMessage.countDocuments({})).toBe(2);
  });
  it("rolls both feeds and the audit back if the second post fails", async () => {
    const original = ChatMessage.create.bind(ChatMessage);
    const spy = vi.spyOn(ChatMessage, "create");
    spy.mockImplementationOnce((...args: any[]) => (original as any)(...args)).mockRejectedValueOnce(new Error("QA second feed failure"));
    const input = draft();
    await expect(publishWinnerAnnouncement(input, adminId)).rejects.toThrow("QA second feed failure"); spy.mockRestore();
    expect(await WinnerAnnouncement.countDocuments({})).toBe(0); expect(await ChatMessage.countDocuments({})).toBe(0);
    expect(notifyChatChange).not.toHaveBeenCalled();
    await publishWinnerAnnouncement(input, adminId); expect(await ChatMessage.countDocuments({})).toBe(2);
  });
  it("requires administrator authorization and validates all draft fields", async () => {
    await request(app).get("/announcements").expect(401);
    await request(app).get("/announcements/recipients?q=QA").set("Authorization", "Bearer user").expect(403);
    await request(app).post("/announcements").set("Authorization", "Bearer user").send(draft()).expect(403);
    for (const body of [{ ...draft(), amountCents: 0 }, { ...draft(), amountCents: 5.5 }, { ...draft(), raffleTitle: " " }, { ...draft(), recipientId: "fake" }, { ...draft(), prizeText: "injected" }])
      await request(app).post("/announcements").set("Authorization", "Bearer admin").send(body).expect(400);
    await request(app).post("/announcements").set("Authorization", "Bearer admin").send({ ...draft(), recipientId: "507f1f77bcf86cd799439099" }).expect(404);
    expect(await ChatMessage.countDocuments({})).toBe(0);
  });
  it("searches real profiles and treats regex characters as literal text", async () => {
    const response = await request(app).get("/announcements/recipients?q=winner").set("Authorization", "Bearer admin").expect(200);
    expect(response.body.data.users[0]).toMatchObject({ id: String(userId), name: "QA Winner" });
    expect(response.body.data.users[0]).not.toHaveProperty("email");
    const escaped = await request(app).get("/announcements/recipients?q=.*").set("Authorization", "Bearer admin").expect(200);
    expect(escaped.body.data.users).toEqual([]);
  });
  it("allows reactions in both official feeds without granting write access", async () => {
    await publishWinnerAnnouncement(draft(), adminId);
    for (const post of await ChatMessage.find()) {
      await listMessages(userId, String(adminId), String(post.conversationId));
      await changeMessage(userId, String(post._id), { emoji: "🎉" });
      const result = await listMessages(userId, String(adminId), String(post.conversationId));
      expect(result.items[0]!.reactions).toMatchObject([{ userId: String(userId), emoji: "🎉" }]);
      await expect(changeMessage(userId, String(post._id), { text: "changed" })).rejects.toMatchObject({ code: "system_message" });
      await changeMessage(userId, String(post._id), { emoji: "" });
      expect((await ChatMessage.findById(post._id))!.reactions).toHaveLength(0);
    }
  });

  it.each([{targets:["news"] as ("news"|"community")[],count:1},{targets:["community"] as ("news"|"community")[],count:1},{targets:["news","community"] as ("news"|"community")[],count:2}])("publishes only in selected destinations $targets",async({targets,count})=>{
    const input={...draft(),destinations:targets};const result=await publishWinnerAnnouncement(input,adminId);
    expect(result.announcement.destinations.map((d:{systemKey:string})=>d.systemKey).sort()).toEqual([...targets].sort());
    expect(await ChatMessage.countDocuments({})).toBe(count);expect((await publishWinnerAnnouncement(input,adminId)).replay).toBe(true);
    await expect(publishWinnerAnnouncement({...input,destinations:targets.length===1?["news","community"]:["news"]},adminId)).rejects.toMatchObject({statusCode:409});
  });

});
