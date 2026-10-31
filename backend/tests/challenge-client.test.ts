import { createHmac } from "node:crypto";
import { expect, it, vi } from "vitest";
vi.mock("../src/config/env.js", async importOriginal => {
  const original = await importOriginal<typeof import("../src/config/env.js")>();
  return { env: { ...original.env, TELEGRAM_BOT_TOKEN: "123:challenge_test_token_01234567890123456789" } };
});
import { isTelegramChallengeClient, requireChallengeRequest } from "../src/services/challenge-client.service.js";
function launch(age = 0) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - age), user: JSON.stringify({ id: 777, first_name: "QA" }) });
  const data = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const key = createHmac("sha256", "WebAppData").update("123:challenge_test_token_01234567890123456789").digest();
  params.set("hash", createHmac("sha256", key).update(data).digest("hex")); return params.toString();
}
it("accepts genuine signed Telegram launch data and rejects tampering or expiry", () => {
  const valid = launch(); expect(isTelegramChallengeClient(valid)).toBe(true);
  expect(isTelegramChallengeClient(valid + "&query_id=forged")).toBe(false);
  expect(isTelegramChallengeClient(launch(86401))).toBe(false);
  expect(isTelegramChallengeClient("x".repeat(8193))).toBe(false);
});
it("keeps installed APKs and verified bot requests working but rejects ordinary browser starts", () => {
  expect(() => requireChallengeRequest({ "user-agent": "okhttp/4.12.0" })).not.toThrow();
  expect(() => requireChallengeRequest({ "user-agent": "Mozilla/5.0", "x-telegram-init-data": launch() })).not.toThrow();
  expect(() => requireChallengeRequest({ "user-agent": "Mozilla/5.0" })).toThrow();
  expect(() => requireChallengeRequest({ "user-agent": "Mozilla/5.0", "x-telegram-init-data": "forged" })).toThrow();
});

