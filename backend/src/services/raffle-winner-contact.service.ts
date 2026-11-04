import { NotificationEvent } from "../models/NotificationEvent.js";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import { RaffleWinNotice, RaffleWinnerReply } from "../models/RaffleWinNotice.js";

export type WinnerTelegramMessage = {
  message_id?: number; text?: string;
  chat?: { id?: number | string; type?: string };
  from?: { id?: number | string };
  contact?: { phone_number?: string; user_id?: number };
};

export function winnerReplyContent(message: WinnerTelegramMessage) {
  if (message.chat?.type !== "private" || !message.message_id || String(message.chat.id) !== String(message.from?.id)) return null;
  if (message.contact?.phone_number && String(message.contact.user_id) === String(message.from?.id)) return message.contact.phone_number.slice(0, 100);
  const text = message.text?.trim();
  return text && !text.startsWith("/") ? text.slice(0, 4096) : null;
}

/** Only registered draw winners' private replies are stored and forwarded. */
export async function captureRaffleWinnerReply(message: WinnerTelegramMessage | undefined) {
  if (!message) return false;
  const text = winnerReplyContent(message);
  if (!text) return false;
  const telegramId = String(message.from!.id);
  const winner = await RaffleWinNotice.findOne({ telegramId }).sort({ createdAt: -1 }).lean();
  if (!winner) return false;
  const reply = await RaffleWinnerReply.findOneAndUpdate({ telegramId, messageId: message.message_id },
    { $setOnInsert: { telegramId, messageId: message.message_id, userId: winner.userId, text } }, { upsert: true, new: true });
  if (reply.forwardedAt) return true;
  const admins = await User.find({ $or: [{ role: "admin" }, { email: { $in: env.ADMIN_EMAILS } }] }).select("_id").lean();
  if (!admins.length) throw new Error("Winner contact administrator is unavailable");
  await NotificationEvent.updateOne({ eventKey: `winner-reply:${telegramId}:${message.message_id}` }, { $setOnInsert: {
    eventKey: `winner-reply:${telegramId}:${message.message_id}`, type: "raffle", audience: "specific_users", status: "queued",
    payload: { userIds: admins.map(admin => String(admin._id)), title: "Ответ победителя 🏆",
      body: `Раунд ${winner.round} · $${(winner.amountCents / 100).toFixed(2)}\nID: ${winner.userId}\nTelegram ID: ${telegramId}\n\n${text}` }
  } }, { upsert: true });
  await RaffleWinnerReply.updateOne({ _id: reply._id }, { $set: { forwardedAt: new Date() } });
  return true;
}
