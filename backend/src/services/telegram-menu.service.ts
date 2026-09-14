import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { localDayKey, dayBoundsInTimeZone } from "../lib/date.js";
import { countryLabel, resolveCountry, countryCodes } from "../lib/countries.js";
import { isValidTimeZone } from "../lib/timezone.js";
import { User } from "../models/User.js";
import { Withdrawal } from "../models/Withdrawal.js";
import { DailyChallengeSet } from "../models/DailyChallengeSet.js";
import { TelegramConversation } from "../models/TelegramConversation.js";
import {
  authenticateTelegram,
  createTelegramResumeUrlForLinkedUser,
  telegramAppUrl
} from "./telegram-auth.service.js";
import { createSandboxWithdrawal } from "./withdrawal.service.js";
import { notifyWithdrawalAdmin } from "./telegram.service.js";

export type MenuMessage = { message_id?: number; text?: string; chat?: { id?: number | string; type?: string }; from?: { id?: number | string; first_name?: string; last_name?: string; username?: string; is_bot?: boolean } };
export const home = [[{ text: "🎮 Mini App", web_app: { url: telegramAppUrl() } }], [{ text: "🏠 Главная" }, { text: "👤 Аккаунт" }], [{ text: "⚙️ Настройки" }, { text: "💰 Баланс" }], [{ text: "⏱ Челлендж" }]];
const settings = [[{ text: "✏️ Имя" }, { text: "🌍 Страна" }], [{ text: "🌐 Язык" }, { text: "🎨 Тема" }], [{ text: "🔔 Уведомления" }, { text: "⏰ Напоминания" }], [{ text: "🕒 Часовой пояс" }, { text: "🎯 Цель накоплений" }], [{ text: "📱 Telegram" }, { text: "🖼 Фото и профиль" }], [{ text: "🏠 Главная" }]];
const confirm = [[{ text: "✅ Подтвердить заявку" }], [{ text: "❌ Отмена" }]];
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export function privateSender(message: MenuMessage): string | null {
  const id = message.from?.id;
  return id && !message.from?.is_bot && message.chat?.type === "private" && String(id) === String(message.chat.id) ? String(id) : null;
}
export function parseAmount(text: string): number | null {
  if (!/^\d{1,9}([.,]\d{1,2})?$/.test(text.trim())) return null;
  const cents = Math.round(Number(text.trim().replace(",", ".")) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}
export function validExpiration(text: string, now = new Date()): boolean {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(text);
  if (!match) return false;
  return Date.UTC(2000 + Number(match[2]), Number(match[1]), 1) > now.getTime();
}
export async function botApi(method: string, body: object): Promise<any> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8_000)
  });
  const result = await response.json() as { ok: boolean; result?: unknown; error_code?: number };
  if (!result.ok) throw new Error(`Telegram ${method} failed (${result.error_code ?? response.status})`);
  return result.result;
}
async function say(chat: string, text: string, keyboard = home) {
  return botApi("sendMessage", { chat_id: chat, text, reply_markup: { keyboard, resize_keyboard: true, is_persistent: true } });
}
async function link(chat: string, user: any, path: string, label: string) {
  const url = await createTelegramResumeUrlForLinkedUser({ telegramId: chat, name: user.name, nextPath: path });
  const miniApp = new URL(telegramAppUrl());
  miniApp.searchParams.set("next", path);
  return botApi("sendMessage", { chat_id: chat, text: "Откройте Mini App в Telegram или приложение. Личная ссылка для входа действует 10 минут.", protect_content: true, reply_markup: { inline_keyboard: [[{ text: label, web_app: { url: miniApp.toString() } }], [{ text: "📲 Открыть приложение / сайт", url }]] } });
}
export function countdown(until: Date, now = new Date()): string {
  const minutes = Math.max(0, Math.ceil((until.getTime() - now.getTime()) / 60_000));
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}
async function challengeText() {
  const now = new Date();
  const today = localDayKey(now, env.DEFAULT_TIMEZONE);
  const active = await DailyChallengeSet.findOne({ dayKey: today, status: "published", endsAt: { $gt: now } }).lean();
  if (active?.endsAt) return { text: `🎮 Челлендж ${active.dayKey}\n🏆 Главный приз: ${active.cashPrizeMaxUnits} LC\n⏳ До завершения: ${countdown(active.endsAt)}\nВремя: ${env.DEFAULT_TIMEZONE}`, until: active.endsAt, available: true };
  const next = await DailyChallengeSet.findOne({ dayKey: { $gt: today }, status: "published" }).sort({ dayKey: 1 }).lean();
  if (next) {
    const start = dayBoundsInTimeZone(next.dayKey, env.DEFAULT_TIMEZONE).from;
    return { text: `⏱ Следующий челлендж: ${next.dayKey}\nДо начала: ${countdown(start)}\nВремя: ${env.DEFAULT_TIMEZONE}`, until: start, available: false };
  }
  return { text: "⏱ Следующий челлендж пока не назначен. После публикации придёт уведомление, если оно включено в настройках.", until: null, available: false };
}
const queues = new Map<string, Promise<unknown>>();
export async function handleTelegramMenu(message: MenuMessage) {
  const chat = privateSender(message);
  if (!chat) return false;
  const previous = queues.get(chat) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(() => processMessage(chat, message));
  queues.set(chat, task);
  try { await task; } finally { if (queues.get(chat) === task) queues.delete(chat); }
  return true;
}
async function processMessage(chat: string, message: MenuMessage) {
  const text = (message.text ?? "").trim().replace(/^(\/[a-z]+)@[A-Za-z0-9_]+(?=\s|$)/i, "$1");
  if (!text || text.length > 500) return;
  const state = await TelegramConversation.findOneAndUpdate({ telegramId: chat }, { $setOnInsert: { expiresAt: new Date(Date.now() + 20 * 60_000), data: {}, step: "" } }, { upsert: true, new: true });
  if (message.message_id && (state.lastMessageId ?? 0) >= message.message_id) return;
  if (state.expiresAt < new Date()) { state.step = ""; state.data = {}; }
  let user = await User.findOne({ "providers.telegramSub": chat });
  if (!user) user = await authenticateTelegram({ id: chat, firstName: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || "Logic member" });
  const cancel = /^(\/cancel|❌ Отмена)$/i.test(text);
  const navigation = ["🏠 Главная", "👤 Аккаунт", "⚙️ Настройки", "💰 Баланс", "⏱ Челлендж", "/start", "/menu", "/balance", "/account", "/settings", "/challenge", "/stop", "/help"].includes(text);
  if (cancel || navigation) { state.step = ""; state.data = {}; }
  try {
    if (cancel) await say(chat, "Действие отменено.");
    else if (text === "/stop") {
      await User.updateOne({ _id: user._id }, { $set: { "preferences.notificationsEnabled": false, "preferences.dailyReminderEnabled": false } });
      state.timerUntil = null;
      await say(chat, "Уведомления отключены. Включить их можно в настройках.");
    } else if (["/start", "/menu", "/help", "🏠 Главная"].includes(text)) {
      const challenge = await challengeText();
      await say(chat, `🏠 Logic Coin\nПривет, ${user.name}!\n\n${challenge.text}`);
      await link(chat, user, "/", "🚀 Открыть Logic Coin");
    } else if (["/account", "👤 Аккаунт"].includes(text)) {
      await say(chat, `👤 ${user.name}\n🌍 ${user.countryCode ? countryLabel(user.countryCode) : "Страна не указана"}\n🌐 Язык: ${user.preferences.language}\n📱 Telegram: ${message.from?.username ? "@" + message.from.username : "подключён"}\n🪙 Монеты: ${user.coins.balance}\nКод приглашения: ${user.referralCode}`);
      await link(chat, user, "/profile", "Открыть аккаунт");
    } else if (["/settings", "⚙️ Настройки"].includes(text)) await say(chat, "⚙️ Выберите настройку:", settings);
    else if (["/balance", "💰 Баланс"].includes(text)) {
      const last = await Withdrawal.find({ userId: user._id }).sort({ requestedAt: -1 }).limit(3).lean();
      await say(chat, `💰 Доступно: ${money(user.wallet.availableUnits * env.UNIT_VALUE_CENTS)}\nНа рассмотрении: ${money(user.wallet.lockedUnits * env.UNIT_VALUE_CENTS)}\n🪙 Монеты: ${user.coins.balance}\nМинимум заявки: ${money(env.MIN_WITHDRAWAL_CENTS)}\n${last.map(w => `${w.accountLabel}: ${money(w.amountCents)} — ${w.status}`).join("\n")}`, [[{ text: "💸 Вывести деньги" }], ...home]);
    } else if (["/challenge", "⏱ Челлендж"].includes(text)) {
      const info = await challengeText();
      const sent = await say(chat, info.text + (info.until ? "\nОбновляется раз в минуту в течение часа; нажмите «Челлендж» для продления." : ""));
      state.timerMessageId = sent.message_id;
      state.timerUntil = info.until ? new Date(Math.min(info.until.getTime(), Date.now() + 3600_000)) : null;
      if (info.available) await link(chat, user, "/challenges", "🚀 Начать челлендж");
    } else if (["✏️ Имя", "🌍 Страна", "🌐 Язык", "🎨 Тема", "🕒 Часовой пояс", "🎯 Цель накоплений"].includes(text)) {
      const fields: Record<string, [string, string]> = {
        "✏️ Имя": ["name", "Введите имя (1–80 символов)."], "🌍 Страна": ["country", `Введите название страны на русском, узбекском или английском, либо двухбуквенный код (например UZ, KZ, DE). В справочнике ${countryCodes.length} стран и территорий.`],
        "🌐 Язык": ["language", "Введите ru, uz или en. Язык не меняет вашу страну."], "🎨 Тема": ["theme", "Введите light, sky или dark."],
        "🕒 Часовой пояс": ["timezone", "Введите часовой пояс, например Asia/Tashkent. Менять его можно раз в 30 дней."], "🎯 Цель накоплений": ["goal", "Введите цель в долларах, например 10.00."]
      };
      const field = fields[text]!; state.step = field[0]; state.data = {}; await say(chat, field[1], [[{ text: "❌ Отмена" }]]);
    } else if (["🔔 Уведомления", "⏰ Напоминания"].includes(text)) {
      const key = text === "🔔 Уведомления" ? "notificationsEnabled" : "dailyReminderEnabled";
      const enabled = !user.preferences[key];
      await User.updateOne({ _id: user._id }, { $set: { [`preferences.${key}`]: enabled } });
      await say(chat, `${text}: ${enabled ? "включены" : "выключены"}.`, settings);
    } else if (text === "📱 Telegram") await say(chat, "Аккаунт привязан к вашему Telegram ID. Имя @username меняется в настройках самого Telegram. Чужой Telegram ID указать нельзя.", settings);
    else if (text === "🖼 Фото и профиль") await link(chat, user, "/profile", "Изменить фото и профиль");
    else if (text === "💸 Вывести деньги") {
      if (user.wallet.availableUnits * env.UNIT_VALUE_CENTS < env.MIN_WITHDRAWAL_CENTS) await say(chat, `Для заявки необходимо минимум ${money(env.MIN_WITHDRAWAL_CENTS)} доступного баланса.`);
      else { state.step = "amount"; state.data = { idempotencyKey: `telegram:${chat}:${randomUUID()}` }; await say(chat, "Введите сумму заявки в долларах. Например 10.00. Полный номер карты, CVV, PIN и коды из SMS не нужны.", [[{ text: "❌ Отмена" }]]); }
    } else if (state.step) await advance(chat, text, state, user);
    else await say(chat, "Выберите раздел меню или отправьте /start.");
  } catch (error) {
    const code = error instanceof ApiError ? error.code : "internal";
    const explanations: Record<string, string> = { insufficient_funds: "Недостаточно доступного баланса.", withdrawal_below_minimum: "Сумма меньше минимальной.", invalid_withdrawal_increment: "Сумма должна соответствовать шагу вывода на сайте." };
    await say(chat, explanations[code] ?? "Не удалось выполнить действие. Повторите попытку или нажмите «Отмена».");
    console.warn("Telegram menu action failed", code);
  }
  if (message.message_id) state.lastMessageId = message.message_id;
  state.expiresAt = new Date(Date.now() + 2 * 3600_000);
  state.markModified("data");
  await state.save();
}
async function advance(chat: string, text: string, state: any, user: any) {
  const data = state.data;
  const set: Record<string, unknown> = {};
  switch (state.step) {
    case "name": if (text.length > 80) return say(chat, "Не более 80 символов."); set.name = text; break;
    case "country": { const code = resolveCountry(text); if (!code) return say(chat, "Страна не найдена. Введите название или код ISO, например UZ."); set.countryCode = code; break; }
    case "language": if (!["ru", "uz", "en"].includes(text)) return say(chat, "Допустимо: ru, uz, en."); set["preferences.language"] = text; break;
    case "theme": if (!["light", "sky", "dark"].includes(text)) return say(chat, "Допустимо: light, sky, dark."); set["preferences.theme"] = text; break;
    case "timezone": {
      if (!isValidTimeZone(text)) return say(chat, "Неизвестный часовой пояс.");
      if (user.preferences.timezone !== text && user.timezoneChangedAt && Date.now() - user.timezoneChangedAt.getTime() < 30 * 86400_000) return say(chat, "Часовой пояс уже менялся за последние 30 дней.");
      set["preferences.timezone"] = text; if (user.preferences.timezone !== text) set.timezoneChangedAt = new Date(); break;
    }
    case "goal": { const value = parseAmount(text); if (value === null || value > 1_000_000_000) return say(chat, "Введите допустимую сумму."); set["preferences.savingsGoalCents"] = value; break; }
    case "amount": {
      const value = parseAmount(text); if (!value || value < env.MIN_WITHDRAWAL_CENTS || value > user.wallet.availableUnits * env.UNIT_VALUE_CENTS || value % env.UNIT_VALUE_CENTS) return say(chat, "Проверьте сумму: минимум, доступный баланс и шаг вывода.");
      data.amountCents = value; state.step = "brand"; return say(chat, "Тип карты: visa, mastercard или other.", [[{ text: "visa" }, { text: "mastercard" }, { text: "other" }], [{ text: "❌ Отмена" }]]);
    }
    case "brand": if (!["visa", "mastercard", "other"].includes(text.toLowerCase())) return say(chat, "Выберите visa, mastercard или other."); data.brand = text.toLowerCase(); state.step = "last4"; return say(chat, "Введите только последние 4 цифры карты.", [[{ text: "❌ Отмена" }]]);
    case "last4": if (!/^\d{4}$/.test(text)) return say(chat, "Нужны ровно последние 4 цифры, не полный номер карты."); data.last4 = text; state.step = "holder"; return say(chat, "Имя держателя карты (2–80 символов).", [[{ text: "❌ Отмена" }]]);
    case "holder": if (text.length < 2 || text.length > 80) return say(chat, "Имя должно содержать 2–80 символов."); data.holderName = text; state.step = "expiration"; return say(chat, "Срок действия в формате MM/YY.", [[{ text: "❌ Отмена" }]]);
    case "expiration": if (!validExpiration(text)) return say(chat, "Введите действующий срок MM/YY."); data.expiration = text; state.step = "confirm"; return say(chat, `Проверьте заявку:\nСумма: ${money(data.amountCents)}\nКарта: ${data.brand} •••• ${data.last4}\nДержатель: ${data.holderName}\nСрок: ${data.expiration}\n\nЗаявка поступит на рассмотрение (до 12 часов), автоматического перевода нет. Нажимая «Подтвердить заявку», вы соглашаетесь с условиями вывода: ${env.APP_PUBLIC_URL}/withdrawal-agreement (версия 2026-08-23).`, confirm);
    case "confirm": {
      if (text !== "✅ Подтвердить заявку") return say(chat, "Подтвердите заявку или отмените её.", confirm);
      const recent = await Withdrawal.countDocuments({ userId: user._id, requestedAt: { $gt: new Date(Date.now() - 3600_000) }, idempotencyKey: { $ne: data.idempotencyKey } });
      if (recent >= 8) return say(chat, "Достигнут лимит заявок за час. Попробуйте позже.");
      const result = await createSandboxWithdrawal({ userId: user._id, amountCents: data.amountCents, card: { brand: data.brand, last4: data.last4, holderName: data.holderName, expiration: data.expiration }, idempotencyKey: data.idempotencyKey, agreementVersion: "2026-08-23" });
      if (!result.idempotentReplay) await notifyWithdrawalAdmin({ userId: user._id.toString(), withdrawalId: result.withdrawal._id.toString(), amountCents: result.withdrawal.amountCents, accountLabel: result.withdrawal.accountLabel ?? "Bank card" });
      state.step = ""; state.data = {}; await state.save();
      return say(chat, `✅ Заявка ${result.withdrawal._id} принята на рассмотрение. Статус доступен в разделе «Баланс».`);
    }
    default: state.step = ""; state.data = {}; return say(chat, "Выберите раздел меню.");
  }
  const changed = await User.updateOne({ _id: user._id, ...(set.timezoneChangedAt ? { $or: [{ timezoneChangedAt: { $exists: false } }, { timezoneChangedAt: { $lte: new Date(Date.now() - 30 * 86400_000) } }] } : {}) }, { $set: set }, { runValidators: true });
  if (!changed.matchedCount) return say(chat, "Настройка уже изменена в другой сессии. Откройте настройки заново.");
  state.step = ""; state.data = {};
  return say(chat, "✅ Настройка сохранена в вашем аккаунте Logic Coin.", settings);
}
let timer: ReturnType<typeof setInterval> | undefined;
let timerBusy = false;
export const TIMER_REFRESH_BATCH_SIZE = 25;
export function startBotTimers() {
  if (timer) return;
  timer = setInterval(() => { void refreshChallengeTimers(); }, 60_000);
  timer.unref();
}
export function stopBotTimers() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
export async function refreshChallengeTimers() {
  if (timerBusy || User.db.readyState !== 1) return;
  timerBusy = true;
  try {
    const refreshedAt = new Date();
    const states = await TelegramConversation.find({
      timerMessageId: { $exists: true },
      timerUntil: { $gt: refreshedAt }
    })
      .sort({ lastTimerRefreshAt: 1, _id: 1 })
      .limit(TIMER_REFRESH_BATCH_SIZE);
    if (!states.length) return;
    const info = await challengeText();
    for (const state of states) {
      try {
        await botApi("editMessageText", {
          chat_id: state.telegramId,
          message_id: state.timerMessageId,
          text: info.text + "\nОбновляется раз в минуту. Для продления нажмите «Челлендж»."
        });
      } catch (error) {
        console.warn(
          "Telegram countdown update failed:",
          error instanceof Error ? error.message : "unknown error"
        );
      }
      try {
        await TelegramConversation.updateOne(
          { _id: state._id },
          { $set: { lastTimerRefreshAt: refreshedAt } }
        );
      } catch (error) {
        console.warn(
          "Telegram countdown timestamp update failed:",
          error instanceof Error ? error.message : "unknown error"
        );
      }
    }
  } catch (error) {
    console.warn(
      "Telegram countdown refresh failed:",
      error instanceof Error ? error.message : "unknown error"
    );
  }
  finally { timerBusy = false; }
}
