import { ApiError } from "../lib/api-error.js";
import { isNativeAppClient, type ClientHeaders } from "../lib/native-client.js";
import { verifyTelegramMiniApp } from "./telegram-auth.service.js";

export function isTelegramChallengeClient(initData: unknown): boolean {
  if (typeof initData !== "string" || !initData || initData.length > 8192) return false;
  try { verifyTelegramMiniApp(initData); return true; } catch { return false; }
}
export function requireChallengeClient(allowed: boolean): void {
  if (!allowed) throw new ApiError(403, "challenge_app_required", "Чтобы играть в челленджи, откройте приложение Logic Coin или Telegram-бота.");
}
export function requireChallengeRequest(headers: ClientHeaders): void {
  requireChallengeClient(isNativeAppClient(headers) || isTelegramChallengeClient(headers["x-telegram-init-data"]));
}
