import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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
    message_id?: number;
    text?: string;
    chat?: { id?: number | string; type?: string };
    from?: {
      id?: number | string;
      first_name?: string;
      last_name?: string;
      username?: string;
      is_bot?: boolean;
    };
  };
};

const LOGIN_TTL_MS = 10 * 60_000;
let cachedBotUsername: string | null = null;
let webhookSetup: Promise<void> | null = null;

export function telegramAppUrl(): string {
  const appUrl = env.APP_PUBLIC_URL || "https://www.logic-coin.online";
  const url = new URL("/login", appUrl);
  url.searchParams.set("v", env.TELEGRAM_WEB_APP_VERSION);
  return url.toString();
}

function requireBotToken(): string {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || token === "replace-me" || !/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
    throw new ApiError(
      503,
      "telegram_auth_unavailable",
      "Telegram sign-in is not configured"
    );
  }
  return token;
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
  const source =
    env.TELEGRAM_WEBHOOK_SECRET ??
    createHmac("sha256", env.JWT_SECRET)
      .update("logic-coin-telegram-webhook")
      .digest("hex");
  return createHash("sha256").update(source).digest("hex");
}

export function telegramWebhookUrl(
  baseUrl = env.API_PUBLIC_URL,
  localPolling = env.TELEGRAM_LOCAL_POLLING,
): string | null {
  if (localPolling) return null;
  const base = new URL(baseUrl);
  if (base.protocol !== "https:") return null;
  return new URL("/api/v1/auth/telegram/webhook", base).toString();
}

async function configureTelegramBotUI() {
  const token = requireBotToken();
  const appUrl = telegramAppUrl();

  const menuResponse = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      menu_button: {
        type: "web_app",
        text: "Logic Coin 🎮",
        web_app: { url: appUrl }
      }
    }),
    signal: AbortSignal.timeout(8_000)
  });
  const menuPayload = (await menuResponse.json().catch(() => null)) as
    | { ok?: boolean; description?: string }
    | null;
  if (!menuResponse.ok || !menuPayload?.ok) {
    throw new ApiError(
      502,
      "telegram_menu_unavailable",
      menuPayload?.description || "Telegram menu could not be configured"
    );
  }

  const commandsResponse = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      commands: [
        { command: "start", description: "Запустить Logic Coin 🎮" },
        { command: "play", description: "Открыть Mini App 🎮" },
        { command: "account", description: "Аккаунт 👤" },
        { command: "settings", description: "Настройки ⚙️" },
        { command: "balance", description: "Баланс 💰" },
        { command: "challenge", description: "Челлендж ⏱" },
        { command: "help", description: "Помощь и меню" },
        { command: "stop", description: "Отключить уведомления" }
      ]
    }),
    signal: AbortSignal.timeout(8_000)
  });
  const commandsPayload = (await commandsResponse.json().catch(() => null)) as
    | { ok?: boolean; description?: string }
    | null;
  if (!commandsResponse.ok || !commandsPayload?.ok) {
    throw new ApiError(
      502,
      "telegram_commands_unavailable",
      commandsPayload?.description || "Telegram commands could not be configured"
    );
  }
}

async function configureTelegramWebhook() {
  const webhookUrl = telegramWebhookUrl();
  if (!webhookUrl) return;

  const response = await fetch(
    `https://api.telegram.org/bot${requireBotToken()}/setWebhook`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: telegramWebhookSecret(),
        allowed_updates: ["message"],
        drop_pending_updates: false
      }),
      signal: AbortSignal.timeout(8_000)
    }
  );
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; description?: string }
    | null;
  if (!response.ok || !payload?.ok) {
    throw new ApiError(
      502,
      "telegram_webhook_unavailable",
      payload?.description || "Telegram webhook could not be configured"
    );
  }

  await configureTelegramBotUI();
}

export async function ensureTelegramWebhook() {
  if (!telegramWebhookUrl()) return;
  if (!webhookSetup) {
    webhookSetup = configureTelegramWebhook().catch((error) => {
      webhookSetup = null;
      throw error;
    });
  }
  await webhookSetup;
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
  const configuredUsername = env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  if (configuredUsername && configuredUsername !== "replace-me") {
    return configuredUsername;
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
  await ensureTelegramWebhook();
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
  const returnUrl = buildTelegramReturnUrl(resumeToken);
  const appUrl = telegramAppUrl();
  const botUrl = `https://api.telegram.org/bot${requireBotToken()}/sendMessage`;
  await fetch(botUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "✅ Вход подтверждён! Возвращайтесь в Logic Coin.",
      protect_content: true
    }),
    signal: AbortSignal.timeout(5_000)
  }).catch(() => undefined);
  await fetch(botUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "Откройте Logic Coin для продолжения:",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎮 Открыть Logic Coin", web_app: { url: appUrl } }],
          [{ text: "🔑 Авторизовать текущую сессию", url: returnUrl }]
        ]
      }
    }),
    signal: AbortSignal.timeout(5_000)
  }).catch(() => undefined);
}

async function sendBotWelcome(chatId: string) {
  const botUrl = `https://api.telegram.org/bot${requireBotToken()}/sendMessage`;
  const appUrl = telegramAppUrl();
  await fetch(botUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "👋 **Добро пожаловать в Logic Coin!**\n\nИграйте в логические игры, участвуйте в челленджах, зарабатывайте монеты и проверяйте свой баланс прямо в Telegram.",
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎮 Открыть Logic Coin", web_app: { url: appUrl } }]
        ]
      }
    }),
    signal: AbortSignal.timeout(5_000)
  }).catch(() => undefined);
}

export function buildTelegramReturnUrl(
  resumeToken: string,
  appPublicUrl = env.APP_PUBLIC_URL,
  nextPath?: string
) {
  const returnUrl = new URL("/telegram-login", appPublicUrl);
  returnUrl.searchParams.set("v", env.TELEGRAM_WEB_APP_VERSION);
  returnUrl.searchParams.set("telegram_token", resumeToken);
  if (nextPath && ["/", "/profile", "/challenges", "/withdraw"].includes(nextPath)) {
    returnUrl.searchParams.set("next", nextPath);
  }
  return returnUrl.toString();
}

export async function createTelegramResumeUrlForLinkedUser(input: {
  telegramId: string;
  name: string;
  nextPath?: string;
}) {
  const resumeToken = randomBytes(32).toString("base64url");
  await TelegramLoginChallenge.create({
    flowId: randomBytes(16).toString("base64url"),
    pollTokenHash: hashOpaqueToken(randomBytes(32).toString("base64url")),
    resumeTokenHash: hashOpaqueToken(resumeToken),
    telegramUser: { id: input.telegramId, firstName: input.name.trim() || "Logic member" },
    confirmedAt: new Date(),
    expiresAt: new Date(Date.now() + LOGIN_TTL_MS)
  });
  return buildTelegramReturnUrl(resumeToken, env.APP_PUBLIC_URL, input.nextPath);
}

export async function confirmTelegramBotUpdate(update: TelegramMessageUpdate) {
  const { handleTelegramMenu, privateSender } = await import("./telegram-menu.service.js");
  if (!update.message || !privateSender(update.message)) return { accepted: true, matched: false };
  const message = update.message;
  const text = message?.text?.trim() ?? "";
  if (
    /^\/(play|app)(?:@[A-Za-z0-9_]+)?$/i.test(text) &&
    message?.chat?.id !== undefined
  ) {
    await sendBotWelcome(String(message.chat.id));
    await handleTelegramMenu({ ...message, text: "/menu" });
    return { accepted: true, matched: false };
  }
  const parsed = parseStartIdentity(update);
  if (!parsed) {
    await handleTelegramMenu(update.message);
    return { accepted: true, matched: false };
  }

  const resumeToken = randomBytes(32).toString("base64url");
  const challenge = await TelegramLoginChallenge.findOneAndUpdate(
    {
      flowId: parsed.flowId,
      confirmedAt: { $exists: false },
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
  await handleTelegramMenu({ ...update.message, text: "/menu" });
  return { accepted: true, matched: true };
}

let localPollingActive = false;
let localPollingOffset = 0;

export async function startTelegramLocalPolling() {
  if (!env.TELEGRAM_LOCAL_POLLING || localPollingActive) return;
  localPollingActive = true;
  const token = requireBotToken();
  await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
    method: "POST",
    signal: AbortSignal.timeout(8_000)
  });
  void (async () => {
    while (localPollingActive) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${token}/getUpdates?timeout=20&offset=${localPollingOffset}`,
          { signal: AbortSignal.timeout(25_000) }
        );
        const payload = (await response.json()) as { ok?: boolean; result?: (TelegramMessageUpdate & { update_id: number })[] };
        if (!payload.ok) throw new Error("Telegram polling failed");
        for (const update of payload.result ?? []) {
          await confirmTelegramBotUpdate(update);
          localPollingOffset = Math.max(localPollingOffset, update.update_id + 1);
        }
      } catch {
        if (localPollingActive) await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
    }
  })();
}

export function stopTelegramLocalPolling() {
  localPollingActive = false;
}

async function consumeConfirmedChallenge(
  filter: Record<string, unknown>,
  consumptionField: "pollConsumedAt" | "resumeConsumedAt"
) {
  const challenge = await TelegramLoginChallenge.findOneAndUpdate(
    {
      ...filter,
      confirmedAt: { $exists: true },
      [consumptionField]: { $exists: false },
      expiresAt: { $gt: new Date() }
    },
    { $set: { [consumptionField]: new Date() } },
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
  }).select("+pollTokenHash confirmedAt pollConsumedAt");
  if (
    !challenge?.pollTokenHash ||
    !opaqueTokenMatches(pollToken, challenge.pollTokenHash)
  ) {
    throw new ApiError(400, "invalid_telegram_flow", "Telegram login has expired");
  }
  if (!challenge.confirmedAt) return null;
  if (challenge.pollConsumedAt) {
    throw new ApiError(409, "telegram_flow_consumed", "Telegram login was already used");
  }
  return consumeConfirmedChallenge({ _id: challenge._id }, "pollConsumedAt");
}

export async function completeTelegramResume(resumeToken: string) {
  const tokenHash = hashOpaqueToken(resumeToken);
  const user = await consumeConfirmedChallenge(
    { resumeTokenHash: tokenHash },
    "resumeConsumedAt"
  );
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
