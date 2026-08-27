import { describe, expect, it } from "vitest";

import {
  buildTelegramReturnUrl,
  telegramWebhookSecret,
  telegramWebhookUrl,
} from "../src/services/telegram-auth.service.js";

describe("Telegram authentication links", () => {
  it("uses a public HTTPS webhook endpoint", () => {
    expect(telegramWebhookUrl("https://logic-coin.vercel.app", false)).toBe(
      "https://logic-coin.vercel.app/api/v1/auth/telegram/webhook",
    );
    expect(telegramWebhookUrl("http://localhost:4000", false)).toBeNull();
    expect(telegramWebhookUrl("https://logic-coin.vercel.app", true)).toBeNull();
  });

  it("returns through the app-opening bridge without leaking token shape", () => {
    const url = new URL(
      buildTelegramReturnUrl("resume-token", "https://logic-coin.vercel.app"),
    );
    expect(url.pathname).toBe("/telegram-login");
    expect(url.searchParams.get("telegram_token")).toBe("resume-token");
  });

  it("produces a Telegram-compatible webhook secret", () => {
    expect(telegramWebhookSecret()).toMatch(/^[a-f0-9]{64}$/);
  });
});
