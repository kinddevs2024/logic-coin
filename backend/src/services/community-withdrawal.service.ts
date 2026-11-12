import { randomBytes } from "node:crypto";
import { Types, type ClientSession } from "mongoose";
import { ChatConversation, ChatMessage } from "../models/Chat.js";
import { User } from "../models/User.js";

/** Called inside the withdrawal review transaction. No sender, card or admin identity. */
export async function postApprovedWithdrawal(input: {
  withdrawalId: Types.ObjectId; userId: Types.ObjectId; amountCents: number;
}, session: ClientSession) {
  const person = await User.findById(input.userId).select("name").session(session).lean();
  if (!person) throw new Error("Withdrawal recipient not found");
  const now = new Date();
  const room = await ChatConversation.findOneAndUpdate({ systemKey: "community" }, {
    $setOnInsert: { kind: "group", title: "Logic Coin Community", visibility: "public", inviteCode: randomBytes(18).toString("base64url") },
    $inc: { lastSeq: 1 }, $set: { lastMessageAt: now },
  }, { new: true, upsert: true, session });
  const recipientName = person.name;
  await ChatMessage.create([{
    conversationId: room._id, seq: room.lastSeq,
    clientId: `withdrawal-approved:${input.withdrawalId}`,
    text: `Вывод одобрен · ${recipientName} · $${(input.amountCents / 100).toFixed(2)}`,
    system: { kind: "withdrawal_approved", recipientId: input.userId, recipientName, amountCents: input.amountCents },
  }], { session });
  await ChatConversation.updateOne({ _id: room._id }, { $max: { lastMessageSeq: room.lastSeq } }, { session });
  return String(room._id);
}
