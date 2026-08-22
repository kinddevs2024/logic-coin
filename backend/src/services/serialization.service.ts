import { env } from "../config/env.js";
import { unitsToCents } from "../lib/money.js";

type ObjectWithId = {
  _id: { toString(): string };
  [key: string]: unknown;
};

export function serializeWallet(walletValue: unknown) {
  const wallet = walletValue as {
    availableUnits?: number;
    lockedUnits?: number;
    lifetimeEarnedUnits?: number;
    referralEarnedUnits?: number;
  };
  const availableUnits = wallet.availableUnits ?? 0;
  const lockedUnits = wallet.lockedUnits ?? 0;
  const lifetimeEarnedUnits = wallet.lifetimeEarnedUnits ?? 0;
  const referralEarnedUnits = wallet.referralEarnedUnits ?? 0;

  return {
    availableUnits,
    availableCents: unitsToCents(availableUnits),
    lockedUnits,
    lockedCents: unitsToCents(lockedUnits),
    lifetimeEarnedUnits,
    lifetimeEarnedCents: unitsToCents(lifetimeEarnedUnits),
    referralEarnedUnits,
    referralEarnedCents: unitsToCents(referralEarnedUnits),
    unitValueCents: env.UNIT_VALUE_CENTS,
    currency: "USD"
  };
}

export function serializeCoins(coinsValue: unknown) {
  const coins = (coinsValue ?? {}) as {
    balance?: number;
    lifetimeEarned?: number;
    referralEarned?: number;
  };
  return {
    balance: coins.balance ?? 0,
    lifetimeEarned: coins.lifetimeEarned ?? 0,
    referralEarned: coins.referralEarned ?? 0
  };
}

export function serializeUser(userValue: unknown) {
  const user = (userValue as { toObject?: () => ObjectWithId }).toObject?.() ??
    (userValue as ObjectWithId);

  const email = String(user.email ?? "");
  return {
    id: user._id.toString(),
    ...(email.endsWith("@telegram.logiccoin.local") ? {} : { email }),
    emailVerified: Boolean(user.emailVerifiedAt),
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role ?? "user",
    referralCode: user.referralCode,
    preferences: user.preferences,
    wallet: serializeWallet(user.wallet),
    coins: serializeCoins(user.coins),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export function serializeGame(gameValue: unknown, language: "en" | "ru" | "uz" = "ru") {
  const game = (gameValue as { toObject?: () => ObjectWithId }).toObject?.() ??
    (gameValue as ObjectWithId);
  const title = (game.title ?? {}) as Record<string, string>;
  const description = (game.description ?? {}) as Record<string, string>;
  const scoring = (game.scoring ?? {}) as {
    higherIsBetter?: boolean;
    maxCoins?: number;
  };

  return {
    id: game._id.toString(),
    key: game.key,
    slug: game.slug,
    icon: game.icon,
    color: game.color,
    engine: game.engine,
    clientPath: game.clientPath ?? null,
    assetPath: game.assetPath ?? null,
    difficulty: game.difficulty ?? "medium",
    enabled: game.enabled !== false,
    sortOrder: Number(game.sortOrder ?? 0),
    scoring: {
      higherIsBetter: scoring.higherIsBetter !== false,
      maxCoins: Number(scoring.maxCoins ?? 1_000)
    },
    title: title[language] ?? title.en ?? String(game.key),
    description: description[language] ?? description.en ?? "",
    titleI18n: title,
    descriptionI18n: description,
    challengeEnabled: game.challengeEnabled !== false,
    practiceEnabled: game.practiceEnabled !== false
  };
}

export function serializeTask(taskValue: unknown, language: "en" | "ru" | "uz" = "ru") {
  const task = (taskValue as { toObject?: () => ObjectWithId }).toObject?.() ??
    (taskValue as ObjectWithId);
  const title = task.title as Record<string, string>;
  const description = task.description as Record<string, string>;
  const rewardUnits = task.rewardUnits as number;

  return {
    id: task._id.toString(),
    key: task.key,
    provider: task.provider,
    type: task.type,
    icon: task.icon,
    title: title[language] ?? title.en,
    description: description[language] ?? description.en,
    titleI18n: title,
    descriptionI18n: description,
    rewardUnits,
    rewardCents: unitsToCents(rewardUnits),
    cooldownSeconds: task.cooldownSeconds,
    dailyLimit: task.dailyLimit
  };
}
