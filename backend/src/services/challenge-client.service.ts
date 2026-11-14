import { ApiError } from "../lib/api-error.js";
import { isNativeAppClient, type ClientHeaders } from "../lib/native-client.js";
import { verifyTelegramMiniApp } from "./telegram-auth.service.js";

/** Allow installed apps or a fresh, bot-signed Telegram Mini App launch. */
export function isChallengeClient(headers: ClientHeaders, telegramInitData: unknown = headers["x-telegram-init-data"]): boolean {
  if (telegramInitData !== undefined && telegramInitData !== null) {
    if (typeof telegramInitData !== "string" || !telegramInitData || telegramInitData.length > 16_384) return false;
    try { verifyTelegramMiniApp(telegramInitData); return true; } catch { return false; }
  }
  return isNativeAppClient(headers);
}
export function requireChallengeClient(allowed: boolean): void {
  if (!allowed) throw new ApiError(403, "challenge_app_required", "Откройте челлендж в приложении Logic Coin или заново запустите мини-приложение через Telegram-бота.");
}
export function requireChallengeRequest(headers: ClientHeaders): void {
  requireChallengeClient(isChallengeClient(headers));
}
