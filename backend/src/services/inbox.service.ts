import { type PipelineStage, Types } from "mongoose";
import { NotificationEvent } from "../models/NotificationEvent.js";
import { NotificationRead } from "../models/NotificationRead.js";
import { DailyContestResult } from "../models/DailyContestResult.js";
import { GiftItem } from "../models/GiftItem.js";
import { User } from "../models/User.js";

export type InboxItem = { id: string; title: string; body: string; createdAt: string; read: boolean; kind: string };

async function pipeline(userId: Types.ObjectId): Promise<PipelineStage[]> {
  const [user, days] = await Promise.all([
    User.findById(userId).select("createdAt").lean(),
    DailyContestResult.distinct("dayKey", { userId })
  ]);
  return [
    { $match: { $or: [
      { audience: "all_users", createdAt: { $gte: user?.createdAt ?? new Date() } },
      { audience: "specific_users", "payload.userIds": userId.toString() },
      { audience: "contest_participants", "payload.dayKey": { $in: days } }
    ] } },
    { $project: { _id: 0, id: { $concat: ["event:", { $toString: "$_id" }] }, kind: "$type", title: { $ifNull: ["$payload.title", "Уведомление"] }, body: { $ifNull: ["$payload.body", ""] }, createdAt: 1 } },
    { $unionWith: { coll: GiftItem.collection.name, pipeline: [
      { $match: { userId } },
      { $project: { _id: 0, id: { $concat: ["gift:", { $toString: "$_id" }] }, kind: { $literal: "gift" }, title: { $literal: "Вы получили подарок" }, body: "$description", createdAt: 1 } }
    ] } },
    { $unionWith: { coll: DailyContestResult.collection.name, pipeline: [
      { $match: { userId } },
      { $project: { _id: 0, id: { $concat: ["result:", { $toString: "$_id" }] }, kind: { $literal: "result" }, title: { $literal: "Ваш результат челленджа" }, body: { $concat: ["Челлендж ", "$dayKey", ". Место: ", { $toString: "$rank" }, ". Откройте результаты челленджа, чтобы посмотреть приз."] }, createdAt: "$settledAt" } }
    ] } },
    { $lookup: { from: NotificationRead.collection.name, let: { notificationId: "$id" }, pipeline: [
      { $match: { userId, $expr: { $eq: ["$notificationId", "$$notificationId"] } } }
    ], as: "receipts" } },
    { $set: { read: { $gt: [{ $size: "$receipts" }, 0] } } },
    { $unset: "receipts" }
  ];
}

export async function listInbox(userId: Types.ObjectId, all: boolean, before?: { date: string; id: string }) {
  const stages = await pipeline(userId);
  if (!all) stages.push({ $match: { read: false } });
  if (before) stages.push({ $match: { $or: [
    { createdAt: { $lt: new Date(before.date) } },
    { createdAt: new Date(before.date), id: { $lt: before.id } }
  ] } });
  stages.push({ $sort: { createdAt: -1, id: -1 } }, { $limit: 11 });
  const rows = await NotificationEvent.aggregate(stages);
  const items = rows.slice(0, 10).map(row => ({ ...row, createdAt: new Date(row.createdAt).toISOString() })) as InboxItem[];
  const last = items.at(-1);
  return { items, next: rows.length > 10 && last ? { date: last.createdAt, id: last.id } : null };
}

export async function markInboxRead(userId: Types.ObjectId, ids: string[]) {
  // Validate ownership through the same audience rules; never accept arbitrary IDs.
  const stages = await pipeline(userId);
  stages.push({ $match: { id: { $in: ids } } }, { $project: { id: 1 } });
  const owned = await NotificationEvent.aggregate(stages);
  if (owned.length) await NotificationRead.bulkWrite(owned.map(row => ({ updateOne: {
    filter: { userId, notificationId: row.id },
    update: { $setOnInsert: { userId, notificationId: row.id, readAt: new Date() } }, upsert: true
  } })), { ordered: false });
  return { marked: owned.length };
}
