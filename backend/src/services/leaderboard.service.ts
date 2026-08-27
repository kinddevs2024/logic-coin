import type { FilterQuery, Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { User, type UserDocument } from "../models/User.js";

export type LeaderboardMetric = "wealth" | "wallet" | "coins" | "lifetime";

type LeanUser = {
  _id: Types.ObjectId;
  name: string;
  avatarUrl?: string | null;
  countryCode?: string | null;
  wallet: { availableUnits: number; lifetimeEarnedUnits: number };
  coins?: { balance?: number };
};

function sortFor(metric: LeaderboardMetric) {
  if (metric === "wallet") return { "wallet.availableUnits": -1, _id: 1 } as const;
  if (metric === "coins") return { "coins.balance": -1, _id: 1 } as const;
  if (metric === "lifetime") return { "wallet.lifetimeEarnedUnits": -1, _id: 1 } as const;
  return { "wallet.availableUnits": -1, "coins.balance": -1, _id: 1 } as const;
}

function aheadFilter(user: LeanUser, metric: LeaderboardMetric): FilterQuery<UserDocument> {
  const coinBalance = user.coins?.balance ?? 0;
  const coinTie =
    coinBalance === 0
      ? { $or: [{ "coins.balance": 0 }, { "coins.balance": { $exists: false } }] }
      : { "coins.balance": coinBalance };
  if (metric === "wallet") {
    return {
      $or: [
        { "wallet.availableUnits": { $gt: user.wallet.availableUnits } },
        { "wallet.availableUnits": user.wallet.availableUnits, _id: { $lt: user._id } }
      ]
    };
  }
  if (metric === "coins") {
    return {
      $or: [
        { "coins.balance": { $gt: coinBalance } },
        { $and: [coinTie, { _id: { $lt: user._id } }] }
      ]
    };
  }
  if (metric === "lifetime") {
    return {
      $or: [
        { "wallet.lifetimeEarnedUnits": { $gt: user.wallet.lifetimeEarnedUnits } },
        {
          "wallet.lifetimeEarnedUnits": user.wallet.lifetimeEarnedUnits,
          _id: { $lt: user._id }
        }
      ]
    };
  }
  return {
    $or: [
      { "wallet.availableUnits": { $gt: user.wallet.availableUnits } },
      {
        "wallet.availableUnits": user.wallet.availableUnits,
        "coins.balance": { $gt: coinBalance }
      },
      {
        $and: [
          { "wallet.availableUnits": user.wallet.availableUnits },
          coinTie,
          { _id: { $lt: user._id } }
        ]
      }
    ]
  };
}

function serializeEntry(user: LeanUser, rank: number) {
  return {
    rank,
    userId: user._id.toString(),
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    countryCode: user.countryCode ?? null,
    walletBalanceUnits: user.wallet.availableUnits ?? 0,
    coinBalance: user.coins?.balance ?? 0,
    lifetimeEarnedUnits: user.wallet.lifetimeEarnedUnits ?? 0
  };
}

export async function getLeaderboard(input: {
  userId: Types.ObjectId;
  metric: LeaderboardMetric;
  limit: number;
}) {
  const [users, self, total] = await Promise.all([
    User.find()
      .select("name avatarUrl countryCode wallet.availableUnits wallet.lifetimeEarnedUnits coins.balance")
      .sort(sortFor(input.metric))
      .limit(input.limit)
      .lean<LeanUser[]>(),
    User.findById(input.userId)
      .select("name avatarUrl countryCode wallet.availableUnits wallet.lifetimeEarnedUnits coins.balance")
      .lean<LeanUser | null>(),
    User.countDocuments()
  ]);
  if (!self) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  const selfRank = (await User.countDocuments(aheadFilter(self, input.metric))) + 1;
  return {
    metric: input.metric,
    total,
    entries: users.map((user, index) => serializeEntry(user, index + 1)),
    self: serializeEntry(self, selfRank)
  };
}
