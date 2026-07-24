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

export function serializeUser(userValue: unknown) {
  const user = (userValue as { toObject?: () => ObjectWithId }).toObject?.() ??
    (userValue as ObjectWithId);

  return {
    id: user._id.toString(),
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    referralCode: user.referralCode,
    preferences: user.preferences,
    wallet: serializeWallet(user.wallet),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
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
