import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { contestPrizePlan } from "../lib/manual-contest-prizes.js";
import { computeContestBands, rankContestStandings } from "../lib/contest.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { User } from "../models/User.js";
import { collectContestStandings } from "./contest.service.js";
import { challengeDayKey } from "./daily-challenge.service.js";
import { listAvatarUrl } from "../lib/list-avatar.js";

export type ProgressCursor = { snapshot: string; offset: number; end?: number };
type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>;
const snapshots = new Map<string, Snapshot>();
let pending: { dayKey: string; promise: Promise<Snapshot> } | undefined;

export function invalidateContestProgress(dayKey: string) {
  for (const [id, value] of snapshots) if (value.dayKey === dayKey) snapshots.delete(id);
  if (pending?.dayKey === dayKey) pending = undefined;
}

async function buildSnapshot(dayKey: string) {
  const [set, standings] = await Promise.all([
    DailyChallengeSet.findOne({ dayKey, status: "published" }).lean(),
    collectContestStandings(dayKey),
  ]);
  const ranked = set ? contestPrizePlan(standings, set).ranked
    : rankContestStandings(standings, computeContestBands(standings.length)).map(row => ({ ...row, cashUnits: 0 }));
  return { id: randomUUID(), createdAt: Date.now(), dayKey, set, standings, ranked };
}

async function snapshotFor(dayKey: string, cursor?: ProgressCursor) {
  for (const [id, value] of snapshots) if (Date.now() - value.createdAt > 300_000) snapshots.delete(id);
  if (cursor) {
    const cached = snapshots.get(cursor.snapshot);
    if (!cached || cached.dayKey !== dayKey) throw new ApiError(409, "ranking_expired", "Refresh the ranking");
    return cached;
  }
  const latest = [...snapshots.values()].at(-1);
  if (latest?.dayKey === dayKey && Date.now() - latest.createdAt < 10_000) return latest;
  if (pending?.dayKey === dayKey) return pending.promise;
  const promise = buildSnapshot(dayKey).then(value => {
    snapshots.set(value.id, value);
    if (snapshots.size > 32) snapshots.delete(snapshots.keys().next().value!);
    return value;
  });
  pending = { dayKey, promise };
  try { return await promise; } finally { if (pending?.promise === promise) pending = undefined; }
}

export async function getContestProgress(userId: Types.ObjectId, cursor?: ProgressCursor) {
  const dayKey = challengeDayKey();
  const snapshot = await snapshotFor(dayKey, cursor);
  const selfIndex = snapshot.ranked.findIndex(row => row.userId === userId.toString());
  const self = snapshot.ranked[selfIndex] ?? null;
  const offset = cursor?.offset ?? Math.max(0, Math.min(selfIndex - 7, snapshot.ranked.length - 15));
  const end = Math.min(offset + 15, cursor?.end ?? Infinity, snapshot.ranked.length);
  const rows = snapshot.ranked.slice(offset, end);
  const users = await User.find({ _id: { $in: rows.map(row => new Types.ObjectId(row.userId)) } }).select("name avatarUrl").lean();
  const byId = new Map(users.map(user => [user._id.toString(), user]));
  return {
    dayKey, participantCount: snapshot.ranked.length,
    self: self ? { rank: self.rank, totalCoins: self.totalCoins, completedGamesCount: self.completedGamesCount, cashUnits: self.cashUnits } : null,
    projectedCashUnits: self?.cashUnits ?? 0,
    previous: offset > 0 ? { snapshot: snapshot.id, offset: Math.max(0, offset - 15), end: offset } : null,
    next: end < snapshot.ranked.length ? { snapshot: snapshot.id, offset: end } : null,
    neighbors: rows.map(row => ({
      userId: row.userId, rank: row.rank, totalCoins: row.totalCoins, cashUnits: row.cashUnits,
      isSelf: row.userId === userId.toString(),
      name: byId.get(row.userId)?.name ?? "Player", avatarUrl: listAvatarUrl(row.userId, byId.get(row.userId)?.avatarUrl),
    })),
  };
}
