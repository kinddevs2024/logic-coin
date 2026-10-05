import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { isNativeAppClient } from "../src/lib/native-client.js";
import { appReturnUrl, serveAppReturnPage } from "../src/lib/app-return-page.js";
import { telegramReturnButtons } from "../src/services/telegram-auth.service.js";

describe("native client compatibility", () => {
  it.each(["okhttp/4.12.0", "Dalvik/2.1.0 (Android 14)", "LogicCoin CFNetwork/1496 Darwin/23"])("recognizes %s", ua => {
    expect(isNativeAppClient({ "user-agent": ua })).toBe(true);
  });
  it.each([{}, { "user-agent": "Mozilla/5.0 (Android 14)" }, { "user-agent": "Mozilla/5.0" }, { "user-agent": "okhttp", "sec-fetch-mode": "cors" }])("does not enable browser challenge play", headers => {
    expect(isNativeAppClient(headers)).toBe(false);
  });
});
describe("Telegram APK return", () => {
  it("uses an ordinary link, never a Mini App button, for APK flows", () => {
    const buttons = telegramReturnButtons("a".repeat(43), "app");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]![0]).not.toHaveProperty("web_app");
    const button = buttons[0]![0]!;
    if (!("url" in button)) throw Error("APK flow unexpectedly uses Mini App");
    const url = new URL(button.url);
    expect(url.pathname).toBe("/api/v1/auth/app/open");
    expect(url.search).toBe("");
    expect(new URLSearchParams(url.hash.slice(1)).get("telegram_token")).toBe("a".repeat(43));
  });
  it("keeps web-origin login available", () => {
    const button = telegramReturnButtons("test-token", "web")[0]![0]!;
    expect(button).toHaveProperty("web_app");
    if (!("web_app" in button)) throw Error("Web login button missing");
    expect(new URL(button.web_app.url).searchParams.get("target")).toBe("web");
  });
  it("opens challenges without any login token", () => {
    expect(appReturnUrl("https://logic-coin.online")).toBe("https://logic-coin.online/api/v1/auth/app/open");
  });
  it("serves a no-store, no-referrer bridge without SPA, analytics or web token consumption", async () => {
    const app = express(); app.get("/open", serveAppReturnPage);
    const result = await request(app).get("/open").expect(200);
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.headers["referrer-policy"]).toBe("no-referrer");
    expect(result.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(result.text).toContain("intent://");
    expect(result.text).toContain("?manual=1");
    expect(result.text).not.toContain("/telegram/complete");
    expect(result.text).not.toContain("<script src=");
    expect(result.text).not.toContain('id="direct"');
    expect(result.text).not.toContain("Вход через Telegram подтверждён");
    expect(result.text.match(/<a /g)).toHaveLength(2);
    expect(result.text).toContain("<details><summary");
    expect(result.text).not.toContain("<details open");
    expect(result.text).toContain("Не открывается приложение?<br>Посмотрите подсказку");
  });
});
