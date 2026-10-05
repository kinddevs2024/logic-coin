import { ApiError } from "./api-error.js";
export type ClientHeaders = Record<string, string | string[] | undefined>;
/** Compatibility gate for installed APKs, not cryptographic device attestation. */
export function isNativeAppClient(headers: ClientHeaders): boolean {
  const ua = headers["user-agent"];
  return typeof ua === "string" && /okhttp|CFNetwork|Dalvik/i.test(ua)
    && !headers["sec-fetch-mode"] && !headers["sec-fetch-site"];
}
export function requireNativeChallengeClient(native: boolean): void {
  if (!native) throw new ApiError(403, "challenge_app_required", "Игры челленджа доступны только в приложении Logic Coin. Откройте приложение на телефоне.");
}
