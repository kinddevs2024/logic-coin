import { Types } from "mongoose";
import { contestNeighborhood } from "../lib/contest-neighbors.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { User } from "../models/User.js";
import { collectContestStandings } from "./contest.service.js";
import { challengeDayKey } from "./daily-challenge.service.js";

export async function getContestProgress(userId: Types.ObjectId) {
  const dayKey = challengeDayKey();
  const set = await DailyChallengeSet.findOne({ dayKey, status: "published" }).lean();
  if (!set) return { dayKey, participantCount: 0, self: null, projectedCashUnits: 0, neighbors: [] };
  const snapshot = contestNeighborhood(await collectContestStandings(dayKey), userId.toString(), set.cashPrizeMinUnits, set.cashPrizeMaxUnits);
  const users = await User.find({ _id: { $in: snapshot.neighbors.map(row => new Types.ObjectId(row.userId)) } }).select("name avatarUrl").lean();
  const byId = new Map(users.map(user => [user._id.toString(), user]));
  return {
    dayKey, ...snapshot,
    neighbors: snapshot.neighbors.map(row => ({
      userId: row.userId, rank: row.rank, totalCoins: row.totalCoins,
      isSelf: row.userId === userId.toString(),
      name: byId.get(row.userId)?.name ?? "Player", avatarUrl: byId.get(row.userId)?.avatarUrl ?? null,
    })),
  };
}
