import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import { env } from "../config/env.js";
import { addDays, dayBoundsInTimeZone } from "../lib/date.js";
import { ApiError } from "../lib/api-error.js";
import { canonicalGameKey } from "../lib/game-key.js";
import { pickSeededSubset } from "../lib/seeded-random.js";
import { ActivityDay } from "../models/ActivityDay.js";
import { BudgetEntry } from "../models/BudgetEntry.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { CoinLedgerEntry } from "../models/CoinLedgerEntry.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { DailyContestResult } from "../models/DailyContestResult.js";
import { DailyContestSettlement } from "../models/DailyContestSettlement.js";
import { Device } from "../models/Device.js";
import { Game } from "../models/Game.js";
import { LedgerEntry } from "../models/LedgerEntry.js";
import { NotificationEvent } from "../models/NotificationEvent.js";
import { User } from "../models/User.js";
import { challengeDayKey } from "./daily-challenge.service.js";
import { serializeGame } from "./serialization.service.js";
import { dispatchNotificationEvent } from "./notification.service.js";
import { settleExpiredDailyContests } from "./contest.service.js";

type ChallengeStatus = "draft" | "published" | "settled";
type ChallengeSelectionMode = "manual" | "random";
type BudgetEntryType =
  | "ad_revenue"
  | "other_revenue"
  | "operating_expense"
  | "manual_credit"
  | "manual_debit";

interface ChallengeSetLike {
  _id: Types.ObjectId;
  dayKey: string;
  timezone: string;
  status: ChallengeStatus;
  selectionMode: "seeded" | ChallengeSelectionMode;
  selectionSeed: string;
  gameIds: Types.ObjectId[];
  cashPrizeMinUnits: number;
  cashPrizeMaxUnits: number;
  prizePoolUnits: number;
  coinPrizeAmounts?: number[];
  maxAttemptsPerGame?: number;
  oneSecondAttemptLimit?: number;
  publishedAt?: Date | null;
  endsAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

function percentGrowth(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 10_000) / 100;
}

async function serializeChallengeSets(sets: readonly ChallengeSetLike[]) {
  const allIds = [...new Set(sets.flatMap((set) => set.gameIds.map(String)))];
  const games = await Game.find({ _id: { $in: allIds } }).lean();
  const gamesById = new Map(games.map((game) => [game._id.toString(), game]));
  return sets.map((set) => ({
    id: set._id.toString(),
    dayKey: set.dayKey,
    timezone: set.timezone,
    status: set.status,
    selectionMode: set.selectionMode === "seeded" ? "random" : set.selectionMode,
    games: set.gameIds
      .map((id) => gamesById.get(id.toString()))
      .filter((game): game is NonNullable<typeof game> => Boolean(game))
      .map((game) => serializeGame(game, "ru")),
    cashPrizeMinUnits: set.cashPrizeMinUnits,
    cashPrizeMaxUnits: set.cashPrizeMaxUnits,
    prizePoolUnits: set.prizePoolUnits,
    coinPrizeAmounts: set.coinPrizeAmounts ?? [0, 0, 0, 0, 0, 0],
    maxAttemptsPerGame: set.maxAttemptsPerGame ?? 1,
    oneSecondAttemptLimit: set.oneSecondAttemptLimit ?? 20,
    publishedAt: set.publishedAt?.toISOString() ?? null,
    endsAt:
      set.endsAt?.toISOString() ??
      (set.publishedAt
        ? new Date(set.publishedAt.getTime() + 24 * 60 * 60 * 1_000).toISOString()
        : null),
    createdAt: set.createdAt?.toISOString() ?? null,
    updatedAt: set.updatedAt?.toISOString() ?? null
  }));
}

export async function getAdminDailyChallenge(dayKey: string) {
  await settleExpiredDailyContests(dayKey);
  const set = (await DailyChallengeSet.findOne({ dayKey }).lean()) as ChallengeSetLike | null;
  if (!set) return null;
  return (await serializeChallengeSets([set]))[0] ?? null;
}

export async function listAdminDailyChallenges(from: string, to: string) {
  await settleExpiredDailyContests();
  const sets = (await DailyChallengeSet.find({ dayKey: { $gte: from, $lte: to } })
    .sort({ dayKey: -1 })
    .lean()) as ChallengeSetLike[];
  return serializeChallengeSets(sets);
}

export async function configureDailyChallenge(input: {
  dayKey: string;
  adminSubject: string;
  selectionMode: ChallengeSelectionMode;
  gameKeys?: string[];
  cashPrizeMinUnits: number;
  cashPrizeMaxUnits: number;
  prizePoolUnits: number;
  coinPrizeAmounts?: number[];
  maxAttemptsPerGame?: number;
  oneSecondAttemptLimit?: number;
  publish: boolean;
}) {
  if (input.cashPrizeMaxUnits < input.cashPrizeMinUnits) {
    throw new ApiError(400, "invalid_prize_range", "Maximum prize must be at least the minimum");
  }
  if (input.prizePoolUnits < input.cashPrizeMaxUnits) {
    throw new ApiError(400, "invalid_prize_pool", "Prize pool must cover at least the first prize");
  }
  const maxAttemptsPerGame = input.maxAttemptsPerGame ?? 1;
  const oneSecondAttemptLimit = input.oneSecondAttemptLimit ?? 20;
  if (!Number.isInteger(maxAttemptsPerGame) || maxAttemptsPerGame < 1 || maxAttemptsPerGame > 100) {
    throw new ApiError(400, "invalid_attempt_limit", "Challenge attempts per game must be between 1 and 100");
  }
  if (!Number.isInteger(oneSecondAttemptLimit) || oneSecondAttemptLimit < 1 || oneSecondAttemptLimit > 100) {
    throw new ApiError(400, "invalid_one_second_attempt_limit", "One Second attempts must be between 1 and 100");
  }

  const eligibleGames = await Game.find({ enabled: true, challengeEnabled: true })
    .sort({ sortOrder: 1, _id: 1 })
    .lean();
  if (eligibleGames.length < 6) {
    throw new ApiError(
      409,
      "challenge_catalog_too_small",
      "At least six enabled challenge games are required"
    );
  }

  let selectionSeed: string;
  let normalizedKeys: string[];
  if (input.selectionMode === "manual") {
    normalizedKeys = (input.gameKeys ?? []).map(canonicalGameKey);
    selectionSeed = `manual:${input.dayKey}`;
  } else {
    selectionSeed = `admin-random:${input.dayKey}:${randomUUID()}`;
    normalizedKeys = pickSeededSubset(
      eligibleGames.map((game) => game.key),
      6,
      selectionSeed
    );
  }

  if (normalizedKeys.length !== 6 || new Set(normalizedKeys).size !== 6) {
    throw new ApiError(400, "invalid_game_set", "Exactly six unique games are required");
  }
  const gamesByKey = new Map(eligibleGames.map((game) => [game.key, game]));
  const chosenGames = normalizedKeys.map((key) => gamesByKey.get(key));
  if (chosenGames.some((game) => !game)) {
    throw new ApiError(400, "invalid_game_set", "Every selected game must be enabled for challenges");
  }
  const gameIds = chosenGames.map((game) => game!._id);

  const existing = await DailyChallengeSet.findOne({ dayKey: input.dayKey });
  if (existing?.status === "settled") {
    throw new ApiError(409, "challenge_already_settled", "A settled challenge cannot be changed");
  }
  const hasAttempts = existing
    ? Boolean(
        await ChallengeAttempt.exists({
          dailyChallengeSetId: existing._id,
          mode: "challenge"
        })
      )
    : false;
  if (existing && hasAttempts) {
    const changedGames = existing.gameIds.map(String).join(",") !== gameIds.map(String).join(",");
    if (changedGames || !input.publish) {
      throw new ApiError(
        409,
        "challenge_has_attempts",
        "A published challenge cannot be replaced or unpublished after participation begins"
      );
    }
  }

  const isFirstPublication = input.publish && existing?.status !== "published";
  const firstPublishedAt = isFirstPublication
    ? new Date()
    : existing?.publishedAt ?? new Date();
  const endsAt = new Date(firstPublishedAt.getTime() + 24 * 60 * 60 * 1_000);
  const update = {
    $set: {
      timezone: env.DEFAULT_TIMEZONE,
      status: input.publish ? ("published" as const) : ("draft" as const),
      selectionMode: input.selectionMode,
      selectionSeed,
      gameIds,
      cashPrizeMinUnits: input.cashPrizeMinUnits,
      cashPrizeMaxUnits: input.cashPrizeMaxUnits,
      prizePoolUnits: input.prizePoolUnits,
      coinPrizeAmounts: input.coinPrizeAmounts ?? [0, 0, 0, 0, 0, 0],
      maxAttemptsPerGame,
      oneSecondAttemptLimit,
      ...(input.publish
        ? { publishedAt: firstPublishedAt, endsAt, publishedBySubject: input.adminSubject }
        : {})
    },
    ...(!input.publish
      ? { $unset: { publishedAt: 1, endsAt: 1, publishedBy: 1, publishedBySubject: 1 } }
      : {})
  };
  await DailyChallengeSet.findOneAndUpdate({ dayKey: input.dayKey }, update, {
    upsert: true,
    new: true,
    runValidators: true
  });

  let notificationEvent = null;
  if (isFirstPublication) {
    const targetCount = await Device.countDocuments({
      notificationsEnabled: true,
      pushToken: { $exists: true, $ne: "" }
    });
    notificationEvent = await NotificationEvent.findOneAndUpdate(
      { eventKey: `daily-challenge-published:${input.dayKey}` },
      {
        $setOnInsert: {
          type: "daily_challenge_published",
          audience: "all_users",
          status: "queued",
          targetCount,
          payload: {
            dayKey: input.dayKey,
            gameKeys: normalizedKeys,
            title: "Новый челлендж доступен"
          }
        }
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();
  }

  const delivery = notificationEvent
    ? notificationEvent.status === "queued"
      ? await dispatchNotificationEvent(notificationEvent._id)
      : {
          status: notificationEvent.status,
          targetCount: notificationEvent.targetCount,
          sentCount: notificationEvent.sentCount ?? 0,
          failedCount: notificationEvent.failedCount ?? 0
        }
    : null;

  return {
    challenge: await getAdminDailyChallenge(input.dayKey),
    notificationEvent: notificationEvent
      ? {
          id: notificationEvent._id.toString(),
          status: delivery!.status,
          targetCount: delivery!.targetCount,
          sentCount: delivery!.sentCount,
          failedCount: delivery!.failedCount
        }
      : null
  };
}

export async function getAdminOverview(dayKey: string) {
  const { from, to } = dayBoundsInTimeZone(dayKey, env.DEFAULT_TIMEZONE);
  const previousDayKey = addDays(dayKey, -1);
  const previousBounds = dayBoundsInTimeZone(previousDayKey, env.DEFAULT_TIMEZONE);
  const [
    registrations,
    previousRegistrations,
    totalUsers,
    activePlayers,
    challengeParticipants,
    completedAttempts,
    coinsIssued,
    moneyIssued,
    challenge,
    settlement
  ] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: from, $lt: to } }),
    User.countDocuments({ createdAt: { $gte: previousBounds.from, $lt: previousBounds.to } }),
    User.countDocuments({}),
    ActivityDay.distinct("userId", { dayKey }),
    ChallengeAttempt.distinct("userId", {
      dayKey,
      mode: "challenge",
      status: { $in: ["started", "completed"] }
    }),
    ChallengeAttempt.countDocuments({ dayKey, mode: "challenge", status: "completed" }),
    CoinLedgerEntry.aggregate<{ total: number }>([
      { $match: { createdAt: { $gte: from, $lt: to } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    LedgerEntry.aggregate<{ total: number }>([
      { $match: { createdAt: { $gte: from, $lt: to }, amountUnits: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$amountUnits" } } }
    ]),
    getAdminDailyChallenge(dayKey),
    DailyContestSettlement.findOne({ dayKey }).lean()
  ]);

  return {
    dayKey,
    timezone: env.DEFAULT_TIMEZONE,
    registrations,
    registrationGrowthPercent: percentGrowth(registrations, previousRegistrations),
    totalUsers,
    activePlayers: activePlayers.length,
    challengeParticipants: challengeParticipants.length,
    completedAttempts,
    coinsIssued: coinsIssued[0]?.total ?? 0,
    moneyIssuedUnits: moneyIssued[0]?.total ?? 0,
    challenge,
    settlement: settlement
      ? {
          status: settlement.status,
          participantCount: settlement.participantCount,
          cashWinnersCount: settlement.cashWinnersCount,
          giftWinnersCount: settlement.caseWinnersCount + (settlement.randomWinnersCount ?? 0),
          boxWinnersCount: settlement.caseWinnersCount,
          randomWinnersCount: settlement.randomWinnersCount ?? 0,
          coinWinnersCount: settlement.coinWinnersCount,
          cashDistributedUnits: settlement.cashDistributedUnits,
          settledAt: settlement.settledAt?.toISOString() ?? null
        }
      : null
  };
}

export async function getAdminAnalytics(dayKey: string) {
  const overview = await getAdminOverview(dayKey);
  const results = await DailyContestResult.find({ dayKey }).sort({ rank: 1 }).limit(500).lean();
  const users = await User.find({ _id: { $in: results.map((result) => result.userId) } })
    .select("name avatarUrl")
    .lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  return {
    ...overview,
    participants: overview.challengeParticipants,
    recipients: results.map((result) => {
      const user = usersById.get(result.userId.toString());
      return {
        userId: result.userId.toString(),
        name: user?.name ?? "Unknown user",
        avatarUrl: user?.avatarUrl ?? null,
        rank: result.rank,
        totalCoins: result.totalCoins,
        rewardType: result.rewardType,
        cashUnits: result.cashUnits ?? 0,
        coinAmount: result.coinAmount ?? 0,
        giftKind: result.giftKind ?? result.caseKind ?? null
      };
    })
  };
}

export async function getBudgetAnalytics(days: number) {
  const to = challengeDayKey();
  const from = addDays(to, 1 - days);
  const previousTo = addDays(from, -1);
  const previousFrom = addDays(previousTo, 1 - days);
  const [
    entries,
    settlements,
    activeUsers,
    previousRevenue,
    lifetimeEntries,
    lifetimeSettlements
  ] = await Promise.all([
    BudgetEntry.aggregate<{ _id: { dayKey: string; type: string }; total: number }>([
      { $match: { dayKey: { $gte: from, $lte: to } } },
      { $group: { _id: { dayKey: "$dayKey", type: "$type" }, total: { $sum: "$amountUnits" } } }
    ]),
    DailyContestSettlement.find({ dayKey: { $gte: from, $lte: to }, status: "settled" })
      .select("dayKey cashDistributedUnits")
      .lean(),
    ActivityDay.distinct("userId", { dayKey: { $gte: from, $lte: to } }),
    BudgetEntry.aggregate<{ total: number }>([
      {
        $match: {
          dayKey: { $gte: previousFrom, $lte: previousTo },
          type: { $in: ["ad_revenue", "other_revenue"] }
        }
      },
      { $group: { _id: null, total: { $sum: "$amountUnits" } } }
    ]),
    BudgetEntry.aggregate<{ _id: BudgetEntryType; total: number }>([
      { $group: { _id: "$type", total: { $sum: "$amountUnits" } } }
    ]),
    DailyContestSettlement.aggregate<{ total: number }>([
      { $match: { status: "settled" } },
      { $group: { _id: null, total: { $sum: "$cashDistributedUnits" } } }
    ])
  ]);
  const byDay = new Map<
    string,
    {
      adRevenueUnits: number;
      otherRevenueUnits: number;
      operatingExpenseUnits: number;
      manualCreditUnits: number;
      manualDebitUnits: number;
    }
  >();
  for (const entry of entries) {
    const current = byDay.get(entry._id.dayKey) ?? {
      adRevenueUnits: 0,
      otherRevenueUnits: 0,
      operatingExpenseUnits: 0,
      manualCreditUnits: 0,
      manualDebitUnits: 0
    };
    if (entry._id.type === "ad_revenue") current.adRevenueUnits += entry.total;
    if (entry._id.type === "other_revenue") current.otherRevenueUnits += entry.total;
    if (entry._id.type === "operating_expense") current.operatingExpenseUnits += entry.total;
    if (entry._id.type === "manual_credit") current.manualCreditUnits += entry.total;
    if (entry._id.type === "manual_debit") current.manualDebitUnits += entry.total;
    byDay.set(entry._id.dayKey, current);
  }
  const spendByDay = new Map(
    settlements.map((settlement) => [settlement.dayKey, settlement.cashDistributedUnits])
  );
  const daily = Array.from({ length: days }, (_, index) => addDays(from, index)).map((dayKey) => {
    const values = byDay.get(dayKey) ?? {
      adRevenueUnits: 0,
      otherRevenueUnits: 0,
      operatingExpenseUnits: 0,
      manualCreditUnits: 0,
      manualDebitUnits: 0
    };
    const challengeSpendUnits = spendByDay.get(dayKey) ?? 0;
    const revenueUnits = values.adRevenueUnits + values.otherRevenueUnits + values.manualCreditUnits;
    return {
      dayKey,
      ...values,
      revenueUnits,
      challengeSpendUnits,
      netUnits:
        revenueUnits - values.operatingExpenseUnits - values.manualDebitUnits - challengeSpendUnits
    };
  });
  const adRevenueUnits = daily.reduce((sum, day) => sum + day.adRevenueUnits, 0);
  const otherRevenueUnits = daily.reduce((sum, day) => sum + day.otherRevenueUnits, 0);
  const totalRevenueUnits = adRevenueUnits + otherRevenueUnits;
  const operatingExpenseUnits = daily.reduce((sum, day) => sum + day.operatingExpenseUnits, 0);
  const challengeSpendUnits = daily.reduce((sum, day) => sum + day.challengeSpendUnits, 0);
  const previousRevenueUnits = previousRevenue[0]?.total ?? 0;
  const lifetimeByType = new Map(lifetimeEntries.map((entry) => [entry._id, entry.total]));
  const platformBalanceUnits =
    (lifetimeByType.get("ad_revenue") ?? 0) +
    (lifetimeByType.get("other_revenue") ?? 0) +
    (lifetimeByType.get("manual_credit") ?? 0) -
    (lifetimeByType.get("operating_expense") ?? 0) -
    (lifetimeByType.get("manual_debit") ?? 0) -
    (lifetimeSettlements[0]?.total ?? 0);
  return {
    range: { from, to, days },
    summary: {
      adRevenueUnits,
      otherRevenueUnits,
      totalRevenueUnits,
      operatingExpenseUnits,
      challengeSpendUnits,
      netUnits: totalRevenueUnits - operatingExpenseUnits - challengeSpendUnits,
      arpuUnits: activeUsers.length === 0 ? 0 : Math.round(totalRevenueUnits / activeUsers.length),
      averageDailyRevenueUnits: Math.round(totalRevenueUnits / days),
      growthPercent: percentGrowth(totalRevenueUnits, previousRevenueUnits),
      activeUsers: activeUsers.length,
      platformBalanceUnits
    },
    daily
  };
}

export async function recordBudgetEntry(input: {
  dayKey: string;
  type: BudgetEntryType;
  amountUnits: number;
  sourceId: string;
  description?: string;
}) {
  try {
    const entry = await BudgetEntry.create(input);
    return {
      id: entry._id.toString(),
      dayKey: entry.dayKey,
      type: entry.type,
      amountUnits: entry.amountUnits,
      sourceId: entry.sourceId,
      description: entry.description ?? null,
      createdAt: entry.createdAt.toISOString()
    };
  } catch (error) {
    if ((error as { code?: number }).code === 11_000) {
      throw new ApiError(409, "budget_entry_exists", "This budget source was already recorded");
    }
    throw error;
  }
}

export async function listAdminGames() {
  const games = await Game.find().sort({ sortOrder: 1, _id: 1 }).lean();
  return games.map((game) => serializeGame(game, "ru"));
}
