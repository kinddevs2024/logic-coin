import mongoose, { Types } from "mongoose";
import {
  CONTEST_CASE_PERCENT,
  CONTEST_CASH_TOP_PERCENT,
  CONTEST_CONSOLATION_COINS,
  CONTEST_RANDOM_PERCENT,
  CONTEST_STANDARD_CASE_KIND,
} from "../config/constants.js";
import { ApiError } from "../lib/api-error.js";
import {
  buildCashPrizeLadder,
  buildContestGiftBundle,
  buildContestRandomReward,
  computeContestBands,
  rankContestStandings,
  type ContestStandingInput
} from "../lib/contest.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { CoinLedgerEntry } from "../models/CoinLedgerEntry.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { DailyContestResult } from "../models/DailyContestResult.js";
import { DailyContestSettlement } from "../models/DailyContestSettlement.js";
import { NotificationEvent } from "../models/NotificationEvent.js";
import { User } from "../models/User.js";
import { grantGift } from "./gift.service.js";
import {
  creditReferralCashPrizeShare,
  creditReferralCoinPrizeShare
} from "./referral.service.js";
import { creditReward } from "./wallet.service.js";
import { dispatchNotificationEvent } from "./notification.service.js";

export async function collectContestStandings(dayKey: string): Promise<ContestStandingInput[]> {
  const attempts = await ChallengeAttempt.find({
    dayKey,
    mode: "challenge",
    status: "completed"
  })
    .select("userId gameId completedAt")
    .lean();

  const byUser = new Map<
    string,
    { gameIds: Set<string>; finishedAt: Date | null; userId: Types.ObjectId }
  >();
  for (const attempt of attempts) {
    const key = attempt.userId.toString();
    const current = byUser.get(key) ?? {
      gameIds: new Set<string>(),
      finishedAt: null,
      userId: attempt.userId
    };
    current.gameIds.add(attempt.gameId.toString());
    if (attempt.completedAt && (!current.finishedAt || attempt.completedAt > current.finishedAt)) {
      current.finishedAt = attempt.completedAt;
    }
    byUser.set(key, current);
  }
  if (byUser.size === 0) return [];

  const totals = await CoinLedgerEntry.aggregate<{ _id: Types.ObjectId; totalCoins: number }>([
    {
      $match: {
        userId: { $in: [...byUser.values()].map((value) => value.userId) },
        type: "challenge_coin_reward",
        "metadata.dayKey": dayKey
      }
    },
    { $group: { _id: "$userId", totalCoins: { $sum: "$amount" } } }
  ]);
  const totalsByUser = new Map(totals.map((entry) => [entry._id.toString(), entry.totalCoins]));

  return [...byUser.entries()].map(([userId, value]) => ({
    userId,
    totalCoins: totalsByUser.get(userId) ?? 0,
    completedGamesCount: value.gameIds.size,
    finishedAt: value.finishedAt?.toISOString() ?? null
  }));
}

async function claimSettlement(dayKey: string) {
  let settlement = await DailyContestSettlement.findOne({ dayKey });
  if (settlement?.status === "settled") {
    return { settlement, alreadySettled: true as const };
  }
  if (!settlement) {
    try {
      settlement = await DailyContestSettlement.create({ dayKey, status: "pending" });
    } catch (error) {
      if ((error as { code?: number }).code !== 11_000) throw error;
      settlement = await DailyContestSettlement.findOne({ dayKey });
    }
  }
  const claimed = await DailyContestSettlement.findOneAndUpdate(
    { dayKey, status: { $in: ["pending", "failed"] } },
    { $set: { status: "settling" }, $unset: { failureReason: 1 } },
    { new: true }
  );
  if (!claimed) {
    const current = await DailyContestSettlement.findOne({ dayKey });
    if (current?.status === "settled") {
      return { settlement: current, alreadySettled: true as const };
    }
    throw new ApiError(409, "settlement_in_progress", "Contest settlement is already in progress");
  }
  return { settlement: claimed, alreadySettled: false as const };
}

export async function settleDailyContest(dayKey: string) {
  const set = await DailyChallengeSet.findOne({ dayKey }).lean();
  if (!set) {
    throw new ApiError(404, "daily_challenge_not_found", "Daily challenge was not found");
  }
  if (set.status === "draft") {
    throw new ApiError(409, "daily_challenge_not_published", "Daily challenge is not published");
  }

  const standings = await collectContestStandings(dayKey);
  const bands = computeContestBands(
    standings.length,
    CONTEST_CASH_TOP_PERCENT,
    CONTEST_CASE_PERCENT,
    CONTEST_RANDOM_PERCENT
  );
  const ranked = rankContestStandings(standings, bands);
  const cashLadder = buildCashPrizeLadder(
    bands.cashWinners,
    set.cashPrizeMinUnits,
    set.cashPrizeMaxUnits
  );
  const cashDistributedUnits = cashLadder.reduce((sum, amount) => sum + amount, 0);
  if (cashDistributedUnits > set.prizePoolUnits) {
    throw new ApiError(
      409,
      "prize_pool_too_small",
      "Prize pool is smaller than the configured cash ladder",
      { requiredUnits: cashDistributedUnits, configuredUnits: set.prizePoolUnits }
    );
  }

  const claim = await claimSettlement(dayKey);
  if (claim.alreadySettled) {
    return { settlement: claim.settlement, alreadySettled: true };
  }

  const settledAt = new Date();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const standing of ranked) {
        const userId = new Types.ObjectId(standing.userId);
        const cashUnits = standing.rewardType === "cash" ? cashLadder[standing.rank - 1]! : 0;
        const box =
          standing.rewardType === "box"
            ? buildContestGiftBundle(dayKey, standing.userId)
            : undefined;
        const random =
          standing.rewardType === "random"
            ? buildContestRandomReward(dayKey, standing.userId)
            : undefined;
        const [result] = await DailyContestResult.create(
          [
            {
              userId,
              dayKey,
              totalCoins: standing.totalCoins,
              completedGamesCount: standing.completedGamesCount,
              rank: standing.rank,
              rewardType: standing.rewardType,
              ...(standing.rewardType === "cash" ? { cashUnits } : {}),
              ...(standing.rewardType === "box"
                ? {
                    caseKind: CONTEST_STANDARD_CASE_KIND,
                    coinAmount: box!.coinAmount,
                    replayCount: box!.replayCount,
                    extraTimeSeconds: box!.extraTimeSeconds
                  }
                : {}),
              ...(standing.rewardType === "random"
                ? {
                    caseKind: "randomizer",
                    giftKind: random!.kind,
                    coinAmount: random!.coinAmount,
                    replayCount: random!.replayCount,
                    extraTimeSeconds: random!.extraTimeSeconds
                  }
                : {}),
              ...(standing.rewardType === "coins"
                ? { coinAmount: CONTEST_CONSOLATION_COINS }
                : {}),
              claimStatus: "pending",
              settledAt
            }
          ],
          { session }
        );
        if (!result) {
          throw new ApiError(500, "settlement_failed", "Contest result could not be created");
        }

      }

      await DailyContestSettlement.updateOne(
        { dayKey, status: "settling" },
        {
          $set: {
            status: "settled",
            participantCount: bands.participantCount,
            cashWinnersCount: bands.cashWinners,
            caseWinnersCount: bands.caseWinners,
            randomWinnersCount: bands.randomWinners,
            coinWinnersCount: bands.coinWinners,
            prizePoolUnits: set.prizePoolUnits,
            cashDistributedUnits,
            settledAt
          }
        },
        { session }
      );
      await DailyChallengeSet.updateOne(
        { _id: set._id },
        { $set: { status: "settled" } },
        { session }
      );
    });
  } catch (error) {
    await DailyContestSettlement.updateOne(
      { dayKey, status: "settling" },
      {
        $set: {
          status: "failed",
          failureReason: error instanceof Error ? error.message.slice(0, 240) : "Settlement failed"
        }
      }
    );
    throw error;
  } finally {
    await session.endSession();
  }

  const notificationEvent = await NotificationEvent.findOneAndUpdate(
    { eventKey: `daily-contest-settled:${dayKey}` },
    {
      $setOnInsert: {
        type: "daily_contest_settled",
        audience: "contest_participants",
        status: "queued",
        targetCount: bands.participantCount,
        payload: {
          dayKey,
          title: "Итоги челленджа готовы",
          body: "Откройте Logic Coin и заберите свой приз."
        }
      }
    },
    { new: true, upsert: true }
  );
  if (notificationEvent.status === "queued") {
    await dispatchNotificationEvent(notificationEvent._id);
  }

  return {
    settlement: await DailyContestSettlement.findOne({ dayKey }),
    alreadySettled: false
  };
}

export async function settleExpiredDailyContests(dayKey?: string, now: Date = new Date()) {
  const legacyCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const expired = await DailyChallengeSet.find({
    status: "published",
    ...(dayKey ? { dayKey } : {}),
    $or: [
      { endsAt: { $lte: now } },
      { endsAt: { $exists: false }, publishedAt: { $lte: legacyCutoff } }
    ]
  })
    .select("dayKey")
    .lean();

  for (const challenge of expired) {
    try {
      await settleDailyContest(challenge.dayKey);
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "settlement_in_progress") {
        throw error;
      }
    }
  }
}

export async function getContestResultForUser(dayKey: string, userId: Types.ObjectId) {
  return DailyContestResult.findOne({ dayKey, userId }).lean();
}

type ContestResultLean = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  dayKey: string;
  totalCoins: number;
  completedGamesCount: number;
  rank: number;
  rewardType: "cash" | "case" | "box" | "random" | "coins";
  cashUnits?: number | null;
  coinAmount?: number | null;
  replayCount?: number | null;
  extraTimeSeconds?: number | null;
  giftKind?: "extra_time" | "replay" | "coin" | null;
  claimStatus?: "pending" | "claiming" | "claimed" | null;
  claimedAt?: Date | null;
  settledAt: Date;
};

function serializeContestResult(result: ContestResultLean) {
  return {
    id: result._id.toString(),
    userId: result.userId.toString(),
    dayKey: result.dayKey,
    totalCoins: result.totalCoins,
    completedGamesCount: result.completedGamesCount,
    rank: result.rank,
    rewardType: result.rewardType === "case" ? "legacy_case" : result.rewardType,
    cashUnits: result.cashUnits ?? 0,
    coinAmount: result.coinAmount ?? 0,
    replayCount: result.replayCount ?? 0,
    extraTimeSeconds: result.extraTimeSeconds ?? 0,
    giftKind: result.giftKind ?? null,
    claimStatus: result.claimStatus ?? "claimed",
    claimedAt: result.claimedAt?.toISOString() ?? null,
    settledAt: result.settledAt.toISOString()
  };
}

async function contestStandings(dayKey: string) {
  const results = (await DailyContestResult.find({ dayKey })
    .sort({ rank: 1 })
    .lean()) as unknown as ContestResultLean[];
  const users = await User.find({ _id: { $in: results.map((entry) => entry.userId) } })
    .select("name avatarUrl countryCode")
    .lean();
  const usersById = new Map(users.map((entry) => [entry._id.toString(), entry]));
  return results.map((entry) => {
    const user = usersById.get(entry.userId.toString());
    return {
      ...serializeContestResult(entry),
      name: user?.name ?? "Игрок",
      avatarUrl: user?.avatarUrl ?? null,
      countryCode: user?.countryCode ?? null
    };
  });
}

export async function getPendingContestReward(userId: Types.ObjectId) {
  const result = (await DailyContestResult.findOne({ userId, claimStatus: "pending" })
    .sort({ settledAt: -1 })
    .lean()) as ContestResultLean | null;
  if (!result) return null;
  return {
    result: serializeContestResult(result),
    standings: await contestStandings(result.dayKey)
  };
}

export async function claimContestReward(resultId: string, userId: Types.ObjectId) {
  if (!Types.ObjectId.isValid(resultId)) {
    throw new ApiError(400, "invalid_contest_result_id", "Contest result id is invalid");
  }
  const session = await mongoose.startSession();
  let claimed: ContestResultLean | null = null;
  try {
    await session.withTransaction(async () => {
      const result = (await DailyContestResult.findOneAndUpdate(
        { _id: resultId, userId, claimStatus: "pending" },
        { $set: { claimStatus: "claiming" } },
        { new: true, session }
      ).lean()) as ContestResultLean | null;
      if (!result) {
        const existing = await DailyContestResult.findOne({ _id: resultId, userId })
          .select("claimStatus")
          .session(session)
          .lean();
        if (existing?.claimStatus === "claimed") {
          throw new ApiError(409, "contest_reward_claimed", "Contest reward was already claimed");
        }
        throw new ApiError(409, "contest_reward_unavailable", "Contest reward is unavailable");
      }

      const sourceId = `contest-claim:${result.dayKey}:${userId.toString()}`;
      const grantNextChallengeCoins = async (amount: number, suffix: string) => {
        if (amount <= 0) return;
        await grantGift(
          {
            userId,
            kind: "coin",
            coinAmount: amount,
            activationMode: "next_challenge",
            sourceDayKey: result.dayKey,
            sourceId: `${sourceId}:${suffix}`,
            description: `${amount} coin на следующий челлендж`
          },
          session
        );
        await creditReferralCoinPrizeShare(
          {
            winnerUserId: userId,
            winnerPrizeCoins: amount,
            dayKey: result.dayKey,
            sourceId: `${sourceId}:${suffix}`
          },
          session
        );
      };
      const grantTime = async (seconds: number, suffix: string) => {
        if (seconds <= 0) return;
        await grantGift(
          {
            userId,
            kind: "extra_time",
            amountSeconds: seconds,
            sourceId: `${sourceId}:${suffix}`,
            description: `Продление времени +${seconds} секунд`
          },
          session
        );
      };
      const grantReplay = async (count: number, suffix: string) => {
        if (count <= 0) return;
        await grantGift(
          {
            userId,
            kind: "replay",
            replayCount: count,
            sourceId: `${sourceId}:${suffix}`,
            description: `Повторное прохождение ×${count}`
          },
          session
        );
      };

      if (result.rewardType === "cash") {
        const amount = result.cashUnits ?? 0;
        await creditReward(
          {
            userId,
            amountUnits: amount,
            type: "contest_cash_prize",
            sourceId,
            description: `Daily contest cash prize (${result.dayKey})`,
            dayKey: result.dayKey,
            metadata: { dayKey: result.dayKey, contest: true, rank: result.rank }
          },
          session
        );
        await creditReferralCashPrizeShare(
          { winnerUserId: userId, winnerPrizeUnits: amount, dayKey: result.dayKey, sourceId },
          session
        );
      } else if (result.rewardType === "box") {
        await grantNextChallengeCoins(result.coinAmount ?? 0, "box-coins");
        await grantReplay(result.replayCount ?? 0, "box-replay");
        await grantTime(result.extraTimeSeconds ?? 0, "box-time");
      } else if (result.rewardType === "random") {
        if (result.giftKind === "coin") await grantNextChallengeCoins(result.coinAmount ?? 0, "random-coins");
        if (result.giftKind === "replay") await grantReplay(result.replayCount ?? 0, "random-replay");
        if (result.giftKind === "extra_time") {
          await grantTime(result.extraTimeSeconds ?? 0, "random-time");
        }
      } else if (result.rewardType === "coins") {
        await grantNextChallengeCoins(result.coinAmount ?? 0, "coins");
      } else {
        throw new ApiError(409, "legacy_reward_already_delivered", "Legacy reward was already delivered");
      }

      const claimedAt = new Date();
      const updated = (await DailyContestResult.findOneAndUpdate(
        { _id: result._id, claimStatus: "claiming" },
        { $set: { claimStatus: "claimed", claimedAt } },
        { new: true, session }
      ).lean()) as ContestResultLean | null;
      if (!updated) throw new ApiError(409, "contest_reward_unavailable", "Contest reward changed");
      claimed = updated;
    });
  } finally {
    await session.endSession();
  }
  if (!claimed) throw new ApiError(500, "contest_reward_claim_failed", "Contest reward claim failed");
  const user = await User.findById(userId).select("wallet coins").lean();
  return {
    result: serializeContestResult(claimed),
    wallet: user?.wallet ?? null,
    coins: user?.coins ?? null
  };
}
