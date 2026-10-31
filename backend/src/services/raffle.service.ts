import mongoose, { Types } from "mongoose";
import { randomInt } from "node:crypto";
import { LiveRaffle } from "../models/LiveRaffle.js";
import { RafflePresence } from "../models/RafflePresence.js";
import { CoinRewardLogin } from "../models/CoinRewardLogin.js";
import { User } from "../models/User.js";
import { NotificationEvent } from "../models/NotificationEvent.js";
import { ApiError } from "../lib/api-error.js";
import { addDays, localDayKey } from "../lib/date.js";
import { countdownMilestone } from "../lib/raffle-policy.js";
import { listAvatarUrl } from "../lib/list-avatar.js";
import { creditReward } from "./wallet.service.js";
import { recordCoinRewardLogin } from "./coin-rewards.service.js";
import { dispatchNotificationEvent } from "./notification.service.js";
const timezone = "Asia/Tashkent";
type Copy = Record<"ru" | "uz" | "en", { title: string; body: string }>;
const oid = (id: string) => { if (!/^[a-f\d]{24}$/i.test(id)) throw new ApiError(400, "invalid_id", "Invalid event ID"); return new Types.ObjectId(id); };
async function notice(key: string, copy: Copy, expiresAt?: Date, session?: mongoose.ClientSession) {
  await NotificationEvent.updateOne({ eventKey: `raffle:${key}` }, { $setOnInsert: {
    type: "raffle", audience: "all_users", status: "queued", targetCount: 0,
    payload: { ...copy.ru, localized: copy, raffle: true, ...(expiresAt ? { expiresAt: expiresAt.toISOString(), transient: true } : {}) },
  } }, { upsert: true, ...(session ? { session } : {}) });
}
function copy(title: string, uz: string, en: string, body = "", bodyUz = body, bodyEn = body): Copy {
  return { ru: { title, body }, uz: { title: uz, body: bodyUz }, en: { title: en, body: bodyEn } };
}
export async function raffleHeartbeat(userId: Types.ObjectId, online: boolean, sessionId = "legacy") {
  const presenceId = `${userId}:${sessionId}`;
  if (!online) { await RafflePresence.deleteOne({ _id: presenceId }); return { eligibleDays: 0 }; }
  const now = new Date(), today = localDayKey(now, timezone);
  await recordCoinRewardLogin(userId, now);
  let presence = await RafflePresence.findById(presenceId).lean();
  if (!presence || presence.dayKey !== today || now.getTime() - presence.checkedAt.getTime() > 60000) {
    const days = await CoinRewardLogin.distinct("dayKey", { userId, dayKey: { $gte: addDays(today, -6), $lte: today } });
    presence = await RafflePresence.findOneAndUpdate({ _id: presenceId }, { $set: { userId, lastSeenAt: now, eligibleDays: new Set(days).size, dayKey: today, checkedAt: now } }, { upsert: true, new: true }).lean();
  } else await RafflePresence.updateOne({ _id: presenceId }, { $set: { lastSeenAt: now } });
  return { eligibleDays: presence?.eligibleDays ?? 0 };
}
export async function listRaffles() { return LiveRaffle.find().sort({ createdAt: -1 }).limit(30).select("title status startsAt revision youtubeId lockMinutes allowRepeatWinners rounds.label rounds.kind rounds.cashUnits rounds.durationSeconds rounds.status rounds._id").lean(); }
export async function saveRaffle(input: { title: string; startsAt: string; lockMinutes: number; youtubeId: string; allowRepeatWinners: boolean; rounds: Array<{ label: string; kind: "cash" | "physical"; cashUnits: number; durationSeconds: number }> }, adminId: Types.ObjectId) {
  if (new Date(input.startsAt).getTime() < Date.now() + 60000) throw new ApiError(400, "future_start_required", "Назначьте время минимум через минуту");
  try { return await LiveRaffle.create({ ...input, startsAt: new Date(input.startsAt), activeSlot: "main", createdBy: adminId }); }
  catch (error) { if ((error as { code?: number }).code === 11000) throw new ApiError(409, "raffle_exists", "Сначала завершите или отмените текущий розыгрыш"); throw error; }
}
export async function publishRaffle(id: string) {
  const event = await LiveRaffle.findOneAndUpdate({ _id: oid(id), status: "draft", startsAt: { $gt: new Date() } }, { $set: { status: "scheduled", publishedAt: new Date() }, $inc: { revision: 1 } }, { new: true });
  if (!event) throw new ApiError(409, "raffle_not_draft", "Не удалось опубликовать событие");
  await announceDay(event);
  return event._id;
}
async function announceDay(event: { _id: Types.ObjectId; title: string; startsAt: Date }) {
  if (localDayKey(new Date(), timezone) !== localDayKey(event.startsAt, timezone)) return;
  const time = event.startsAt.toLocaleTimeString("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
  await notice(`${event._id}:today`, copy("Сегодня розыгрыш", "Bugun sovrinli o‘yin", "Prize draw today", `${event.title} · ${time} (Toshkent)`, `${event.title} · ${time} (Toshkent)`, `${event.title} · ${time} (Tashkent)`));
}
export async function raffleState(userId?: Types.ObjectId, admin = false) {
  const event = await LiveRaffle.findOne({ status: { $in: ["scheduled", "live"] } }).lean();
  if (!event) return { event: null, serverNow: new Date().toISOString() };
  const presence = userId ? await RafflePresence.findOne({ userId }).lean() : null;
  const now = new Date();
  const current = event.rounds.find(r => r.status === "spinning") ?? [...event.rounds].reverse().find(r => r.status === "finished") ?? event.rounds[0];
  const visible = current?.participants.slice(0, 60) ?? [];
  const winner = current?.status === "finished" ? current.participants.find(p => String(p.userId) === String(current.winnerId)) : undefined;
  return { serverNow: now.toISOString(), event: {
    id: String(event._id), title: event.title, startsAt: event.startsAt.toISOString(), status: event.status,
    lockMinutes: event.lockMinutes, youtubeId: event.youtubeId, revision: event.revision,
    today: localDayKey(now, timezone) === localDayKey(event.startsAt, timezone),
    eligibleDays: presence?.eligibleDays ?? 0,
    locked: now.getTime() >= event.startsAt.getTime() - event.lockMinutes * 60000 && now.getTime() < event.startsAt.getTime() + 2 * 3600000,
    rounds: event.rounds.map(r => ({ id: String(r._id), label: r.label, kind: r.kind, cashUnits: r.cashUnits, durationSeconds: r.durationSeconds, status: r.status })),
    current: current ? { id: String(current._id), label: current.label, kind: current.kind, cashUnits: current.cashUnits, status: current.status,
      startedAt: current.startedAt?.toISOString(), finishesAt: current.finishesAt?.toISOString(),
      participantCount: current.participants.length,
      participants: visible.map(p => ({ id: String(p.userId), name: p.name, avatarUrl: p.avatarUrl ?? null })),
      winner: winner ? { id: String(winner.userId), name: winner.name, avatarUrl: winner.avatarUrl ?? null } : null,
    } : null,
    ...(admin ? { onlineCount: await RafflePresence.countDocuments({ lastSeenAt: { $gte: new Date(Date.now() - 20000) } }), eligibleOnlineCount: await RafflePresence.countDocuments({ lastSeenAt: { $gte: new Date(Date.now() - 20000) }, eligibleDays: { $gte: 6 }, dayKey: localDayKey(now, timezone) }) } : {}),
  } };
}
export async function spinRaffle(id: string, roundId: string) {
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const now = new Date();
    const event = await LiveRaffle.findOne({ _id: oid(id), status: "live" }).session(session);
    if (!event || event.rounds.some(r => r.status === "spinning")) throw new ApiError(409, "round_busy", "Событие не началось или раунд уже идёт");
    const round = event.rounds.find(r => String(r._id) === roundId);
    if (!round || round.status !== "pending" || event.rounds.find(r => r.status === "pending") !== round) throw new ApiError(409, "round_order", "Запускайте раунды по порядку");
    const online = await RafflePresence.find({ lastSeenAt: { $gte: new Date(now.getTime() - 20000) }, eligibleDays: { $gte: 6 }, dayKey: localDayKey(now, timezone) }).session(session).lean();
    const ids = online.map(p => p.userId);
    // Re-read six distinct attendance days inside the draw transaction; do not trust client eligibility.
    const eligible = await CoinRewardLogin.aggregate<{ _id: Types.ObjectId }>([
      { $match: { userId: { $in: ids }, dayKey: { $gte: addDays(localDayKey(now, timezone), -6), $lte: localDayKey(now, timezone) } } },
      { $group: { _id: "$userId", days: { $addToSet: "$dayKey" } } }, { $match: { "days.5": { $exists: true } } },
    ]).session(session);
    const previous = event.allowRepeatWinners ? [] : event.rounds.flatMap(r => r.winnerId ? [r.winnerId] : []);
    const users = await User.find({ _id: { $in: eligible.map(p => p._id), $nin: previous }, role: "user" }).select("name avatarUrl").session(session).lean();
    if (!users.length) throw new ApiError(409, "no_eligible_players", "Нет подходящих игроков онлайн");
    if (users.length > 20000) throw new ApiError(409, "raffle_capacity", "Слишком много участников для одного раунда");
    round.participants = users.map(u => ({ userId: u._id, name: u.name, avatarUrl: listAvatarUrl(u._id, u.avatarUrl) ?? undefined })) as typeof round.participants;
    round.winnerId = users[randomInt(users.length)]!._id;
    round.status = "spinning"; round.startedAt = now; round.finishesAt = new Date(now.getTime() + round.durationSeconds * 1000);
    event.revision++; await event.save({ session });
    await notice(`${event._id}:${round._id}:spin`, copy("Рулетка запущена", "Qur’a boshlandi", "The draw is spinning", round.label), undefined, session);
  }); } finally { await session.endSession(); }
}
export async function settleRaffle(id: Types.ObjectId) {
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const event = await LiveRaffle.findOne({ _id: id, status: "live" }).session(session);
    const round = event?.rounds.find(r => r.status === "spinning" && r.finishesAt && r.finishesAt <= new Date());
    if (!event || !round || !round.winnerId) return;
    const winner = round.participants.find(p => String(p.userId) === String(round.winnerId));
    if (!winner) throw new Error("Missing draw winner");
    const sourceId = `raffle:${event._id}:${round._id}`;
    if (round.kind === "cash" && round.cashUnits > 0) {
      await creditReward({ userId: round.winnerId, amountUnits: round.cashUnits, type: "raffle_cash_prize", sourceId, description: round.label.slice(0,240), metadata: { raffleId: String(event._id), roundId: String(round._id) } }, session);
    }
    round.status = "finished"; round.settledAt = new Date(); event.revision++; await event.save({ session });
    await notice(`${event._id}:${round._id}:winner`, copy("Победитель розыгрыша", "Qur’a g‘olibi", "Draw winner", `${winner.name} — ${round.label}`), undefined, session);
  }); } finally { await session.endSession(); }
}
export async function finishRaffle(id: string, cancel: boolean) {
  const filter = { _id: oid(id), status: { $in: ["draft", "scheduled", "live"] }, "rounds.status": { $ne: "spinning" } };
  const event = await LiveRaffle.findOneAndUpdate(filter, { $set: { status: cancel ? "cancelled" : "ended", endedAt: new Date() }, $unset: { activeSlot: 1 }, $inc: { revision: 1 } }, { new: true });
  if (!event) throw new ApiError(409, "round_busy", "Дождитесь окончания текущего раунда");
  if (event.publishedAt) await notice(`${event._id}:ended`, copy(cancel ? "Розыгрыш отменён" : "Розыгрыш завершён", cancel ? "Qur’a bekor qilindi" : "Qur’a yakunlandi", cancel ? "Draw cancelled" : "Draw ended", event.title));
}
let ticking = false;
let previouslyVisible = false;
export async function tickRaffles() {
  if (ticking) return; ticking = true;
  try {
    const events = await LiveRaffle.find({ status: { $in: ["scheduled", "live"] } }).lean();
    for (const event of events) {
      if (event.status === "scheduled") {
        await announceDay(event);
        const seconds = countdownMilestone(event.startsAt, new Date());
        if (seconds !== null) await notice(`${event._id}:countdown:${seconds}`, copy(`До розыгрыша ${seconds} с`, `Qur’agacha ${seconds} soniya`, `Draw starts in ${seconds}s`, event.title), new Date(event.startsAt.getTime() - (seconds - (seconds <= 10 ? 1 : 10)) * 1000));
        if (event.startsAt <= new Date()) {
          await LiveRaffle.updateOne({ _id: event._id, status: "scheduled" }, { $set: { status: "live" }, $inc: { revision: 1 } });
          await notice(`${event._id}:started`, copy("Розыгрыш начался", "Qur’a boshlandi", "The live draw has started", event.title));
        }
      } else await settleRaffle(event._id);
    }
    if (events.length || previouslyVisible) {
      const state = await raffleState();
      const { broadcastRaffleState } = await import("./live-updates.service.js");
      broadcastRaffleState(state); previouslyVisible = Boolean(state.event);
    }
    const queued = await NotificationEvent.find({ type: "raffle", status: "queued" }).sort({ createdAt: 1 }).limit(25).select("_id").lean();
    // Dispatch concurrently: a slow push provider must not serially delay every tick.
    for (const event of queued) void dispatchNotificationEvent(event._id).catch(() => {});
  } finally { ticking = false; }
}
export function startRaffleWorker() { const timer = setInterval(() => { void tickRaffles().catch(() => console.error("Raffle tick failed")); }, 1000); return () => clearInterval(timer); }
