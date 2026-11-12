import { createHash, randomBytes } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import type { WinnerAnnouncementInput } from "../lib/winner-announcement.js";
import { WinnerAnnouncement } from "../models/WinnerAnnouncement.js";
import { ChatConversation, ChatMessage } from "../models/Chat.js";
import { User } from "../models/User.js";
import { notifyChatChange } from "./live-updates.service.js";

export async function findWinnerRecipients(query: string) {
  const text = query.trim();
  if (text.length < 2) return { users: [] };
  const regex = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const users = await User.find({ $or: [{ name: regex }, { username: regex }, { referralCode: text.toUpperCase() }, ...(Types.ObjectId.isValid(text) ? [{ _id: new Types.ObjectId(text) }] : [])] }).select("name username referralCode").sort({ name: 1, _id: 1 }).limit(15).lean();
  return { users: users.map(u => ({ id: String(u._id), name: u.name, username: u.username ?? null, referralCode: u.referralCode })) };
}
function serialize(row: any) {
  return { id: String(row._id), recipientId: String(row.recipientId), recipientName: row.recipientName, raffleTitle: row.raffleTitle,
    prizeType: row.prizeType as "cash" | "item", ...(row.prizeType === "cash" ? { amountCents: row.amountCents as number } : { prizeText: row.prizeText as string }),
    createdAt: new Date(row.createdAt).toISOString(), destinations: row.messages.map((m: any) => ({ systemKey: m.systemKey, conversationId: String(m.conversationId), messageId: String(m.messageId) })) };
}
export async function listWinnerAnnouncements() {
  return { items: (await WinnerAnnouncement.find().sort({ createdAt: -1, _id: -1 }).limit(30).lean()).map(serialize) };
}
export async function publishWinnerAnnouncement(input: WinnerAnnouncementInput, adminId: Types.ObjectId) {
  const fingerprint = createHash("sha256").update(JSON.stringify({ recipientId: input.recipientId.toLowerCase(), raffleTitle: input.raffleTitle, prizeType: input.prizeType, prize: input.prizeType === "cash" ? input.amountCents : input.prizeText })).digest("hex");
  const filter = { createdBy: adminId, operationId: input.operationId };
  const replay = (row: any) => {
    if (row.fingerprint !== fingerprint) throw new ApiError(409, "announcement_changed", "Эта публикация уже отправлена с другими данными. Создайте новое объявление.");
    return { announcement: serialize(row), replay: true };
  };
  const previous = await WinnerAnnouncement.findOne(filter).lean();
  if (previous) return replay(previous);
  const session = await mongoose.startSession();
  let publishedId: Types.ObjectId | undefined;
  try {
    await session.withTransaction(async () => {
      const person = await User.findById(input.recipientId).select("name").session(session).lean();
      if (!person) throw new ApiError(404, "winner_not_found", "Пользователь не найден. Выберите победителя заново.");
      const now = new Date();
      const prize = input.prizeType === "cash" ? { amountCents: input.amountCents } : { prizeText: input.prizeText };
      const [record] = await WinnerAnnouncement.create([{ ...filter, recipientId: person._id, recipientName: person.name, raffleTitle: input.raffleTitle, prizeType: input.prizeType, ...prize, fingerprint }], { session });
      const messages = [];
      for (const [systemKey, kind, title] of [["news", "channel", "Logic Coin"], ["community", "group", "Logic Coin Community"]] as const) {
        const room = await ChatConversation.findOneAndUpdate({ systemKey }, {
          $setOnInsert: { kind, title, visibility: "public", inviteCode: randomBytes(18).toString("base64url") },
          $inc: { lastSeq: 1 }, $set: { lastMessageAt: now },
        }, { new: true, upsert: true, session });
        const displayPrize = input.prizeType === "cash" ? `$${(input.amountCents / 100).toFixed(2)}` : input.prizeText;
        const [message] = await ChatMessage.create([{
          conversationId: room._id, seq: room.lastSeq, clientId: `winner-announcement:${record!._id}`,
          text: `Победитель розыгрыша · ${person.name} · ${displayPrize} · ${input.raffleTitle}`,
          system: { kind: "raffle_winner", recipientId: person._id, recipientName: person.name, raffleTitle: input.raffleTitle, ...prize },
          createdAt: now,
        }], { session });
        await ChatConversation.updateOne({ _id: room._id }, { $max: { lastMessageSeq: room.lastSeq } }, { session });
        messages.push({ systemKey, conversationId: room._id, messageId: message!._id });
      }
      await WinnerAnnouncement.updateOne({ _id: record!._id }, { $set: { messages } }, { session });
      publishedId = record!._id;
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const duplicate = await WinnerAnnouncement.findOne(filter).lean();
      if (duplicate) return replay(duplicate);
    }
    throw error;
  } finally { await session.endSession(); }
  const record = await WinnerAnnouncement.findById(publishedId).lean();
  if (!record) throw new Error("Published announcement missing");
  for (const message of record.messages) notifyChatChange(null, String(message.conversationId));
  return { announcement: serialize(record), replay: false };
}
