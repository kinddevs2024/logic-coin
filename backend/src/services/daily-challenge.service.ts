import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import {
  DAILY_CHALLENGE_GAME_COUNT,
  DEFAULT_DAILY_PRIZE_MAX_UNITS,
  DEFAULT_DAILY_PRIZE_MIN_UNITS,
  DEFAULT_DAILY_PRIZE_POOL_UNITS
} from "../config/constants.js";
import { env } from "../config/env.js";
import { currentMonthBounds, dayBoundsInTimeZone, localDayKey } from "../lib/date.js";
import { ApiError } from "../lib/api-error.js";
import { pickSeededSubset } from "../lib/seeded-random.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { CoinLedgerEntry } from "../models/CoinLedgerEntry.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { Game } from "../models/Game.js";
import { NotificationEvent } from "../models/NotificationEvent.js";
import { User } from "../models/User.js";
import { serializeCoins, serializeGame } from "./serialization.service.js";
import { settleExpiredDailyContests } from "./contest.service.js";
import { dispatchNotificationEvent } from "./notification.service.js";

export function challengeDayKey(date: Date = new Date()): string {
  return localDayKey(date, env.DEFAULT_TIMEZONE);
}

export async function getDailyChallengeSet(dayKey: string = challengeDayKey()) {
  await settleExpiredDailyContests(dayKey);
  return ensureDailyChallengeSet(dayKey);
}

/**
 * Guarantees that a challenge exists for the requested day so a new one
 * appears every 24 hours without manual publishing.
 *
 * A missing set is auto-created (published, six random eligible games,
 * default prizes) only for today or past days. Future days are left alone
 * so admins can configure them manually. Returns null when there is
 * nothing to create (future day, or fewer than six eligible games).
 */
export async function ensureDailyChallengeSet(dayKey: string = challengeDayKey()) {
  const existing = await DailyChallengeSet.findOne({ dayKey });
  if (existing) return existing;
  if (dayKey > challengeDayKey()) return null;

  const eligibleGames = await Game.find({ enabled: true, challengeEnabled: true })
    .sort({ sortOrder: 1, _id: 1 })
    .lean();
  if (eligibleGames.length < DAILY_CHALLENGE_GAME_COUNT) return null;

  const selectionSeed = `auto-daily:${dayKey}:${randomUUID()}`;
  const pickedKeys = pickSeededSubset(
    eligibleGames.map((game) => game.key),
    DAILY_CHALLENGE_GAME_COUNT,
    selectionSeed
  );
  const gamesByKey = new Map(eligibleGames.map((game) => [game.key, game]));
  const gameIds = pickedKeys.map((key) => gamesByKey.get(key)!._id);
  const publishedAt = new Date();

  const set = await DailyChallengeSet.findOneAndUpdate(
    { dayKey },
    {
      $setOnInsert: {
        dayKey,
        timezone: env.DEFAULT_TIMEZONE,
        status: "published",
        selectionMode: "random",
        selectionSeed,
        gameIds,
        cashPrizeMinUnits: DEFAULT_DAILY_PRIZE_MIN_UNITS,
        cashPrizeMaxUnits: DEFAULT_DAILY_PRIZE_MAX_UNITS,
        prizePoolUnits: DEFAULT_DAILY_PRIZE_POOL_UNITS,
        coinPrizeAmounts: [0, 0, 0, 0, 0, 0],
        maxAttemptsPerGame: 1,
        oneSecondAttemptLimit: 20,
        publishedAt,
        endsAt: new Date(publishedAt.getTime() + 24 * 60 * 60 * 1_000),
        publishedBySubject: "auto-daily"
      }
    },
    { upsert: true, new: true, runValidators: true }
  );
  const notification = await NotificationEvent.findOneAndUpdate(
    { eventKey: `daily-challenge-published:${dayKey}` },
    {
      $setOnInsert: {
        type: "daily_challenge_published",
        audience: "all_users",
        status: "queued",
        targetCount: 0,
        payload: {
          dayKey,
          gameKeys: pickedKeys,
          title: "Новый челлендж доступен",
          body: "Шесть новых игр уже ждут вас в Logic Coin."
        }
      }
    },
    { upsert: true, new: true, runValidators: true }
  );
  if (notification.status === "queued") await dispatchNotificationEvent(notification._id);
  return set;
}

export async function getTodayChallengeOverview(userId: Types.ObjectId) {
  const user = await User.findById(userId).select("preferences.language coins");
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  const language = user.preferences.language ?? "ru";
  const dayKey = challengeDayKey();
  const todayBounds = dayBoundsInTimeZone(dayKey, env.DEFAULT_TIMEZONE);
  const month = currentMonthBounds(dayKey);
  const [monthlyChallengeDays, gamesCompletedToday] = await Promise.all([
    typeof ChallengeAttempt.distinct === "function"
      ? ChallengeAttempt.distinct("dayKey", { userId, mode: "challenge", status: { $in: ["started", "completed"] }, dayKey: { $gte: month.from, $lte: month.to } })
      : [],
    typeof ChallengeAttempt.countDocuments === "function"
      ? ChallengeAttempt.countDocuments({ userId, status: "completed", completedAt: { $gte: todayBounds.from, $lt: todayBounds.to } })
      : 0
  ]);
  const set = await getDailyChallengeSet(dayKey);
  if (!set || set.status !== "published") {
    return {
      status: "no_challenge" as const,
      available: false,
      dayKey,
      nextChallengeAt: dayBoundsInTimeZone(dayKey, env.DEFAULT_TIMEZONE).to.toISOString(),
      totalCount: 0,
      completedCount: 0,
      gamesCompletedToday,
      totalCoinsToday: 0,
      monthlyChallengeCount: monthlyChallengeDays.length,
      games: [],
      coins: serializeCoins(user.coins),
      doubling: {
        firstGameKey: null,
        gameDoubled: false,
        dayDoubled: false,
        dayEligible: false
      },
      prizes: null
    };
  }
  const gameIds = set.gameIds as Types.ObjectId[];

  const [games, attempts, dayDoubleEntry, ledgerTotal] = await Promise.all([
    Game.find({ _id: { $in: gameIds }, enabled: true }).lean(),
    ChallengeAttempt.find({
      userId,
      dayKey,
      mode: "challenge",
      status: { $in: ["started", "completed"] }
    }).lean(),
    CoinLedgerEntry.exists({
      userId,
      type: "challenge_coin_reward",
      sourceId: `double-day:${dayKey}`
    }),
    CoinLedgerEntry.aggregate<{ total: number }>([
      {
        $match: {
          userId,
          type: "challenge_coin_reward",
          "metadata.dayKey": dayKey
        }
      },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ])
  ]);

  const gamesById = new Map(games.map((game) => [game._id.toString(), game]));
  const attemptsByGame = new Map(attempts.map((attempt) => [attempt.gameId.toString(), attempt]));
  const items = gameIds
    .map((gameId) => {
      const game = gamesById.get(gameId.toString());
      if (!game) return null;
      const attempt = attemptsByGame.get(gameId.toString());
      const metadata = (attempt?.metadata ?? {}) as { doubled?: boolean };
      return {
        ...serializeGame(game, language),
        ...(game.key === "one-second"
          ? { attemptLimit: Math.max(1, Math.min(100, set.oneSecondAttemptLimit ?? 20)) }
          : {}),
        state: {
          status: attempt?.status ?? "not_started",
          score: attempt?.score ?? null,
          coinsAwarded: attempt?.coinsAwarded ?? 0,
          doubled: metadata.doubled === true,
          completedAt: attempt?.completedAt?.toISOString() ?? null
        }
      };
    })
    .filter((item) => item !== null);

  const completedCount = items.filter((item) => item.state.status === "completed").length;
  return {
    status: "published" as const,
    available: true,
    dayKey,
    nextChallengeAt: null,
    totalCount: items.length,
    completedCount,
    gamesCompletedToday,
    totalCoinsToday: ledgerTotal[0]?.total ?? 0,
    monthlyChallengeCount: monthlyChallengeDays.length,
    games: items,
    coins: serializeCoins(user.coins),
    doubling: {
      firstGameKey: items[0]?.key ?? null,
      gameDoubled: items[0]?.state.doubled ?? false,
      dayDoubled: Boolean(dayDoubleEntry),
      dayEligible: items.length === DAILY_CHALLENGE_GAME_COUNT && completedCount === items.length
    },
    prizes: {
      cashMinUnits: set.cashPrizeMinUnits,
      cashMaxUnits: set.cashPrizeMaxUnits,
      poolUnits: set.prizePoolUnits
      ,coinPrizeAmounts: set.coinPrizeAmounts ?? [0, 0, 0, 0, 0, 0]
    }
  };
}
