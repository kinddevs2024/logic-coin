import mongoose, { Types } from "mongoose";
import {
  CONTEST_CASE_PERCENT,
  CONTEST_CASH_TOP_PERCENT,
  CONTEST_CONSOLATION_COINS,
  CONTEST_STANDARD_CASE_KIND,
  GIFT_COIN_AMOUNT,
  GIFT_REPLAY_COUNT,
  GIFT_TIME_EXTENSION_SECONDS
} from "../config/constants.js";
import { ApiError } from "../lib/api-error.js";
import {
  buildCashPrizeLadder,
  computeContestBands,
  contestGiftKindForIndex,
  rankContestStandings,
  type ContestStandingInput
} from "../lib/contest.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { CoinLedgerEntry } from "../models/CoinLedgerEntry.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { DailyContestResult } from "../models/DailyContestResult.js";
import { DailyContestSettlement } from "../models/DailyContestSettlement.js";
import { creditCoins } from "./coin.service.js";
import { grantGift } from "./gift.service.js";
import {
  creditReferralCashPrizeShare,
  creditReferralCoinPrizeShare
} from "./referral.service.js";
import { creditReward } from "./wallet.service.js";

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
    CONTEST_CASE_PERCENT
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
        const giftKind =
          standing.rewardType === "case"
            ? contestGiftKindForIndex(standing.rank - bands.cashWinners - 1)
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
              ...(standing.rewardType === "case"
                ? { caseKind: CONTEST_STANDARD_CASE_KIND, giftKind }
                : {}),
              ...(standing.rewardType === "coins"
                ? { coinAmount: CONTEST_CONSOLATION_COINS }
                : {}),
              settledAt
            }
          ],
          { session }
        );
        if (!result) {
          throw new ApiError(500, "settlement_failed", "Contest result could not be created");
        }

        const sourceId = `contest:${dayKey}:${standing.userId}`;
        if (standing.rewardType === "cash") {
          await creditReward(
            {
              userId,
              amountUnits: cashUnits,
              type: "contest_cash_prize",
              sourceId,
              description: `Daily contest cash prize (${dayKey})`,
              dayKey,
              metadata: { dayKey, contest: true, rank: standing.rank }
            },
            session
          );
          await creditReferralCashPrizeShare(
            { winnerUserId: userId, winnerPrizeUnits: cashUnits, dayKey, sourceId },
            session
          );
        } else if (standing.rewardType === "case") {
          await grantGift(
            {
              userId,
              kind: giftKind!,
              ...(giftKind === "extra_time"
                ? { amountSeconds: GIFT_TIME_EXTENSION_SECONDS }
                : giftKind === "replay"
                  ? { replayCount: GIFT_REPLAY_COUNT }
                  : { coinAmount: GIFT_COIN_AMOUNT }),
              sourceId,
              description: `Daily contest ${giftKind} gift (${dayKey})`
            },
            session
          );
        } else {
          await creditCoins(
            {
              userId,
              amount: CONTEST_CONSOLATION_COINS,
              type: "daily_consolation",
              sourceId,
              description: `Daily contest coin prize (${dayKey})`,
              metadata: { dayKey, contest: true, rank: standing.rank }
            },
            session
          );
          await creditReferralCoinPrizeShare(
            {
              winnerUserId: userId,
              winnerPrizeCoins: CONTEST_CONSOLATION_COINS,
              dayKey,
              sourceId
            },
            session
          );
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

  return {
    settlement: await DailyContestSettlement.findOne({ dayKey }),
    alreadySettled: false
  };
}

export async function getContestResultForUser(dayKey: string, userId: Types.ObjectId) {
  return DailyContestResult.findOne({ dayKey, userId }).lean();
}
