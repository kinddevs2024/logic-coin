import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Types } from "mongoose";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { hashOpaqueToken, opaqueTokenMatches } from "../lib/crypto.js";
import { TelegramLoginChallenge } from "../models/TelegramLoginChallenge.js";
import { User } from "../models/User.js";
import { createUser } from "./user.service.js";

export type TelegramIdentity = {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
};

type TelegramMessageUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: {
      id?: number | string;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
};

const LOGIN_TTL_MS = 10 * 60_000;
let cachedBotUsername: string | null = null;

function requireBotToken(): string {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new ApiError(
      503,
      "telegram_auth_unavailable",
      "Telegram sign-in is not configured"
    );
  }
  return env.TELEGRAM_BOT_TOKEN;
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function startSignature(flowId: string): string {
  return createHmac("sha256", env.JWT_SECRET)
    .update(`telegram-start:${flowId}`)
    .digest("base64url")
    .slice(0, 14);
}

export function telegramWebhookSecret(): string {
  return (
    env.TELEGRAM_WEBHOOK_SECRET ??
    createHmac("sha256", env.JWT_SECRET)
      .update("logic-coin-telegram-webhook")
      .digest("hex")
  );
}

function telegramName(identity: TelegramIdentity): string {
  return [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim();
}

export async function authenticateTelegram(identity: TelegramIdentity) {
  let user = await User.findOne({ "providers.telegramSub": identity.id });
  const now = new Date();
  if (!user) {
    user = await createUser({
      email: `telegram-${identity.id}@telegram.logiccoin.local`,
      name: telegramName(identity) || identity.username || "Logic member",
      emailVerifiedAt: now,
      telegramSub: identity.id
    });
    if (identity.photoUrl) {
      user.avatarUrl = identity.photoUrl;
      await user.save();
    }
    return user;
  }

  user.lastLoginAt = now;
  const nextName = telegramName(identity);
  if (nextName) user.name = nextName;
  if (identity.photoUrl) user.avatarUrl = identity.photoUrl;
  await user.save();
  return user;
}

async function resolveBotUsername(): Promise<string> {
  if (env.TELEGRAM_BOT_USERNAME) {
    return env.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
  }
  if (cachedBotUsername) return cachedBotUsername;

  const response = await fetch(
    `https://api.telegram.org/bot${requireBotToken()}/getMe`,
    { signal: AbortSignal.timeout(5_000) }
  );
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; result?: { username?: string } }
    | null;
  if (!response.ok || !payload?.ok || !payload.result?.username) {
    throw new ApiError(
      502,
      "telegram_bot_unavailable",
      "Telegram bot is unavailable"
    );
  }
  cachedBotUsername = payload.result.username;
  return cachedBotUsername;
}

export async function createTelegramLogin() {
  requireBotToken();
  const flowId = randomBytes(16).toString("base64url");
  const pollToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LOGIN_TTL_MS);
  await TelegramLoginChallenge.create({
    flowId,
    pollTokenHash: hashOpaqueToken(pollToken),
    expiresAt
  });

  const botUsername = await resolveBotUsername();
  const start = `lc_${flowId}_${startSignature(flowId)}`;
  return {
    flowId,
    pollToken,
    botUrl: `https://t.me/${botUsername}?start=${start}`,
    expiresInSeconds: Math.floor(LOGIN_TTL_MS / 1_000)
  };
}

function parseStartIdentity(update: TelegramMessageUpdate): {
  flowId: string;
  identity: TelegramIdentity;
  chatId: string;
} | null {
  const message = update.message;
  const text = message?.text?.trim() ?? "";
  const match = text.match(/^\/start(?:@[A-Za-z0-9_]+)?\s+lc_([A-Za-z0-9_-]{20,30})_([A-Za-z0-9_-]{14})$/);
  if (!match || !message?.from?.id || !message.chat?.id) return null;
  const [, flowId, signature] = match;
  if (!flowId || !signature || signature !== startSignature(flowId)) return null;
  return {
    flowId,
    chatId: String(message.chat.id),
    identity: {
      id: String(message.from.id),
      firstName: message.from.first_name?.trim() || "Logic member",
      ...(message.from.last_name ? { lastName: message.from.last_name } : {}),
      ...(message.from.username ? { username: message.from.username } : {})
    }
  };
}

async function sendBotReturnLink(chatId: string, resumeToken: string) {
  const returnUrl = new URL("/login", env.APP_PUBLIC_URL);
  returnUrl.searchParams.set("telegram_token", resumeToken);
  await fetch(`https://api.telegram.org/bot${requireBotToken()}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "Logic Coin",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Открыть Logic Coin", url: returnUrl.toString() }]
        ]
      }
    }),
    signal: AbortSignal.timeout(5_000)
  }).catch(() => undefined);
}

export async function confirmTelegramBotUpdate(update: TelegramMessageUpdate) {
  const parsed = parseStartIdentity(update);
  if (!parsed) return { accepted: true, matched: false };

  const resumeToken = randomBytes(32).toString("base64url");
  const challenge = await TelegramLoginChallenge.findOneAndUpdate(
    {
      flowId: parsed.flowId,
      confirmedAt: { $exists: false },
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date() }
    },
    {
      $set: {
        telegramUser: parsed.identity,
        confirmedAt: new Date(),
        resumeTokenHash: hashOpaqueToken(resumeToken)
      }
    },
    { new: true }
  );
  if (!challenge) return { accepted: true, matched: false };
  await sendBotReturnLink(parsed.chatId, resumeToken);
  return { accepted: true, matched: true };
}

async function consumeConfirmedChallenge(filter: Record<string, unknown>) {
  const challenge = await TelegramLoginChallenge.findOneAndUpdate(
    {
      ...filter,
      confirmedAt: { $exists: true },
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date() }
    },
    { $set: { consumedAt: new Date() } },
    { new: false }
  );
  if (!challenge?.telegramUser) return null;
  return authenticateTelegram({
    id: challenge.telegramUser.id,
    firstName: challenge.telegramUser.firstName,
    ...(challenge.telegramUser.lastName
      ? { lastName: challenge.telegramUser.lastName }
      : {}),
    ...(challenge.telegramUser.username
      ? { username: challenge.telegramUser.username }
      : {}),
    ...(challenge.telegramUser.photoUrl
      ? { photoUrl: challenge.telegramUser.photoUrl }
      : {})
  });
}

export async function pollTelegramLogin(flowId: string, pollToken: string) {
  const challenge = await TelegramLoginChallenge.findOne({
    flowId,
    expiresAt: { $gt: new Date() }
  }).select("+pollTokenHash confirmedAt consumedAt");
  if (
    !challenge?.pollTokenHash ||
    !opaqueTokenMatches(pollToken, challenge.pollTokenHash)
  ) {
    throw new ApiError(400, "invalid_telegram_flow", "Telegram login has expired");
  }
  if (!challenge.confirmedAt) return null;
  if (challenge.consumedAt) {
    throw new ApiError(409, "telegram_flow_consumed", "Telegram login was already used");
  }
  return consumeConfirmedChallenge({ _id: challenge._id });
}

export async function completeTelegramResume(resumeToken: string) {
  const tokenHash = hashOpaqueToken(resumeToken);
  const user = await consumeConfirmedChallenge({ resumeTokenHash: tokenHash });
  if (!user) {
    throw new ApiError(400, "invalid_telegram_token", "Telegram login has expired");
  }
  return user;
}

export function verifyTelegramMiniApp(initData: string): TelegramIdentity {
  const botToken = requireBotToken();
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userJson = params.get("user");
  if (!receivedHash || !authDate || !userJson) {
    throw new ApiError(400, "invalid_telegram_data", "Telegram data is incomplete");
  }
  if (Math.abs(Date.now() / 1_000 - authDate) > 86_400) {
    throw new ApiError(401, "telegram_data_expired", "Telegram data has expired");
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  if (!safeEqualHex(receivedHash, expectedHash)) {
    throw new ApiError(401, "invalid_telegram_data", "Telegram data is invalid");
  }

  let telegramUser: {
    id?: number | string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  };
  try {
    telegramUser = JSON.parse(userJson) as typeof telegramUser;
  } catch {
    throw new ApiError(400, "invalid_telegram_data", "Telegram user data is invalid");
  }
  if (!telegramUser.id || !telegramUser.first_name) {
    throw new ApiError(400, "invalid_telegram_data", "Telegram user is unavailable");
  }
  return {
    id: String(telegramUser.id),
    firstName: telegramUser.first_name,
    ...(telegramUser.last_name ? { lastName: telegramUser.last_name } : {}),
    ...(telegramUser.username ? { username: telegramUser.username } : {}),
    ...(telegramUser.photo_url ? { photoUrl: telegramUser.photo_url } : {})
  };
}

export function assertTelegramWebhookSecret(value: string | undefined) {
  const expected = telegramWebhookSecret();
  const actual = value ?? "";
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new ApiError(401, "invalid_telegram_webhook", "Telegram webhook is invalid");
  }
}

export type TelegramUserId = Types.ObjectId;
