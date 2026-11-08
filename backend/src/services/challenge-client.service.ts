import { ApiError } from "../lib/api-error.js";
import { isNativeAppClient, type ClientHeaders } from "../lib/native-client.js";
export function requireChallengeClient(allowed: boolean): void {
  if (!allowed) throw new ApiError(403, "challenge_app_required", "Чтобы играть в челленджи, откройте приложение Logic Coin на телефоне.");
}
export function requireChallengeRequest(headers: ClientHeaders): void {
  requireChallengeClient(isNativeAppClient(headers) && !headers["x-telegram-init-data"]);
}
