import mongoose, { Types } from "mongoose";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { User } from "../src/models/User.js";
import { ChatConversation, ChatMember, ChatMessage, ChatBlock, ChatFriendship, ChatAttachment } from "../src/models/Chat.js";
import { RefreshSession } from "../src/models/RefreshSession.js";
import { NotificationEvent } from "../src/models/NotificationEvent.js";
import { chatAccess, chatMembers, listChats, listMessages, sendChatMessage, readChatAttachment } from "../src/services/chat.service.js";
import meRouter from "../src/routes/me.routes.js";
const uri = process.env.QA_MONGODB_URI;
describe.skipIf(!uri)("shared support and paged members in isolated MongoDB", () => {
  let ids: Record<string, Types.ObjectId>;
  beforeAll(async () => {
    if (!uri?.startsWith("mongodb://127.0.0.1:27951/")) throw Error("Isolated database only");
    await mongoose.connect(uri, { dbName: `support_qa_${Date.now()}` });
    await Promise.all([User.init(), ChatConversation.init(), ChatMember.init(), ChatMessage.init(), NotificationEvent.init()]);
  });
  beforeEach(async () => {
    await Promise.all([User, ChatConversation, ChatMember, ChatMessage, ChatBlock, ChatFriendship, NotificationEvent, ChatAttachment, RefreshSession].map(model => (model as any).deleteMany({})));
    ids = Object.fromEntries(["user", "other", "manager", "admin", "owner"].map(role => [role, new Types.ObjectId()]));
    await User.create(Object.entries(ids).map(([role, _id]) => ({ _id, name: role, email: `${role}@test.invalid`, referralCode: `SUPPORT${role.toUpperCase()}`, role: role === "other" ? "user" : role })));
  });
  afterAll(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const input = (text = "Isolated support QA") => ({ clientId: new Types.ObjectId().toString(), text, attachmentIds: [] });
  const ticket = async () => (await listChats(ids.user!, "qa")).find(c => c.kind === "support")!;
  it("delivers one customer conversation to every staff role, with shared replies and real audit authors", async () => {
    const room = await ticket();
    const initial = await sendChatMessage(ids.user!, room.id, input());
    const notification = await NotificationEvent.findOne({ eventKey: `chat:${initial.id}` }).lean();
    expect((notification!.payload as any).userIds.sort()).toEqual([ids.manager, ids.admin, ids.owner].map(String).sort());
    for (const role of ["manager", "admin", "owner"]) {
      const inbox = (await listChats(ids[role]!, "qa")).find(c => c.id === room.id);
      expect(inbox?.title).toBe("user"); expect(inbox?.peer?.id).toBe(String(ids.user));
      const sent = await sendChatMessage(ids[role]!, room.id, input(`Reply by ${role}`));
      expect(String((await ChatMessage.findById(sent.id))!.senderId)).toBe(String(ids[role]));
      const event = await NotificationEvent.findOne({ eventKey: `chat:${sent.id}` }).lean();
      expect((event!.payload as any).userIds.sort()).toEqual(["user", "manager", "admin", "owner"].filter(r => r !== role).map(r => String(ids[r])).sort());
    }
    const messages = await listMessages(ids.user!, "qa", room.id);
    expect(messages.items).toHaveLength(4);
    expect(messages.items[0]!.sender.name).toBe("user");
    for (const m of messages.items.slice(1)) expect(m.sender).toMatchObject({ name: "Logic Coin Support", isSupportTeam: true });
    for (const role of ["manager", "admin", "owner"]) expect((await listMessages(ids[role]!, "qa", room.id)).items).toHaveLength(4);
    expect((await listChats(ids.user!, "qa")).find(c => c.id === room.id)).toMatchObject({ title: "Logic Coin Support", isOfficial: true, peer: null, peerReadSeq: 4 });
  });
  it("keeps customers separate even with a stale or forged membership; demotion revokes access", async () => {
    const room = await ticket(); await sendChatMessage(ids.user!, room.id, input());
    await ChatMember.create({ conversationId: room.id, userId: ids.other });
    for (const actor of [ids.other!, ids.owner!]) {
      if (actor === ids.owner) await User.updateOne({ _id: actor }, { $set: { role: "user" } });
      await expect(listMessages(actor, "qa", room.id)).rejects.toMatchObject({ statusCode: 403 });
      await expect(sendChatMessage(actor, room.id, input())).rejects.toMatchObject({ statusCode: 403 });
      expect((await listChats(actor, "qa")).some(c => c.id === room.id)).toBe(false);
    }
    const sent = await sendChatMessage(ids.user!, room.id, input());
    const event = await NotificationEvent.findOne({ eventKey: `chat:${sent.id}` }).lean();
    expect((event!.payload as any).userIds).not.toContain(String(ids.owner));
    expect((event!.payload as any).userIds).not.toContain(String(ids.other));
  });
  it("revokes signed customer attachment access immediately after staff demotion", async () => {
    const room = await ticket();
    const asset = await ChatAttachment.create({ ownerId: ids.user, name: "qa.txt", kind: "file", mime: "text/plain", size: 5, storageKey: "isolated-qa-only" });
    await sendChatMessage(ids.user!, room.id, { ...input(), attachmentIds: [String(asset._id)] });
    const session = await RefreshSession.create({ userId: ids.manager, tokenHash: "isolated-qa-session", expiresAt: new Date(Date.now() + 60000) });
    const message = (await listMessages(ids.manager!, String(session._id), room.id)).items[0]!;
    const url = new URL(message.attachments[0]!.url, "http://test.invalid");
    const read = () => readChatAttachment(String(asset._id), url.searchParams.get("u")!, url.searchParams.get("s")!, Number(url.searchParams.get("e")), url.searchParams.get("t")!);
    expect((await read()).name).toBe("qa.txt");
    await User.updateOne({ _id: ids.manager }, { $set: { role: "user" } });
    await expect(read()).rejects.toMatchObject({ statusCode: 403, code: "media_denied" });
  });
  it("newly promoted employees can see earlier requests and ordinary users cannot post official news", async () => {
    const room = await ticket(); await sendChatMessage(ids.user!, room.id, input());
    await User.updateOne({ _id: ids.other }, { $set: { role: "manager" } });
    expect((await listChats(ids.other!, "qa")).some(c => c.id === room.id)).toBe(true);
    expect((await listMessages(ids.other!, "qa", room.id)).items).toHaveLength(1);
    const news = await ChatConversation.findOne({ systemKey: "news" });
    await expect(sendChatMessage(ids.user!, String(news!._id), input())).rejects.toMatchObject({ statusCode: 403 });
  });
  it("accepts support requests without an administrator and preserves legacy history", async () => {
    await User.updateMany({ role: "admin" }, { $set: { role: "user" } });
    const legacy = await ChatConversation.create({ kind: "support", directKey: `support:${ids.user}`, title: "Logic Coin Support", ownerId: ids.admin });
    await ChatMember.create([{ conversationId: legacy._id, userId: ids.user }, { conversationId: legacy._id, userId: ids.admin, role: "owner" }]);
    expect((await ticket()).id).toBe(String(legacy._id));
    await sendChatMessage(ids.user!, String(legacy._id), input());
    expect((await listMessages(ids.manager!, "qa", String(legacy._id))).items).toHaveLength(1);
    await expect(chatAccess(ids.admin!, String(legacy._id))).rejects.toMatchObject({ statusCode: 403 });
  });
  it("paginates 6 members with stable, non-overlapping cursors and validates access", async () => {
    const room = await ChatConversation.create({ kind: "group", title: "Paged QA" });
    const extra = await User.create(Array.from({ length: 12 }, (_, i) => ({ name: `Person ${i}`, email: `paged${i}@test.invalid`, referralCode: `PAGED${i}` })));
    await ChatMember.create([ids.user!, ...extra.map(u => u._id)].map(userId => ({ conversationId: room._id, userId })));
    const first = await chatMembers(ids.user!, String(room._id)); expect(first.members).toHaveLength(6); expect(first.count).toBe(13);
    const second = await chatMembers(ids.user!, String(room._id), first.nextCursor!); expect(second.members).toHaveLength(6);
    const third = await chatMembers(ids.user!, String(room._id), second.nextCursor!); expect(third.members).toHaveLength(1); expect(third.nextCursor).toBeNull();
    expect(new Set([...first.members, ...second.members, ...third.members].map(m => m.id)).size).toBe(13);
    await expect(chatMembers(ids.other!, String(room._id))).rejects.toMatchObject({ statusCode: 403 });
    await expect(chatMembers(ids.user!, String(room._id), "bad-cursor")).rejects.toMatchObject({ statusCode: 400 });
  });
  it("stores the one-time introduction on the account without changing other preferences", async () => {
    const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.auth = { userId: ids.user!, sessionId: "qa" } as any; next(); }); app.use(meRouter);
    app.use((err: any, _req: any, res: any, _next: any) => res.status(err.statusCode || 400).json({ error: err.message }));
    const before = (await User.findById(ids.user))!.preferences;
    const result = await request(app).patch("/preferences").send({ homeIntroSeen: true }); expect(result.status).toBe(200);
    expect(result.body.data.preferences.homeIntroSeen).toBe(true); expect(result.body.data.preferences.language).toBe(before.language);
    expect((await request(app).get("/preferences")).body.data.preferences.homeIntroSeen).toBe(true);
    expect((await request(app).patch("/preferences").send({ homeIntroSeen: false })).status).toBe(400);
  });
});
