import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { legacyThemeCompatibility, legacyThemePayload } from "../src/middleware/legacy-theme.js";

describe("legacy APK theme compatibility", () => {
  const payload = { data: { user: { id: "test", preferences: { theme: "auto", language: "ru" } }, tokens: { accessToken: "unchanged" } } };
  const app = express();
  app.use(legacyThemeCompatibility);
  app.get("/", (_req, res) => res.json(payload));

  it.each(["okhttp/4.12.0", "LogicCoin/1.2.6 CFNetwork/1496", "Dalvik/2.1.0"]) (
    "serves a safe theme to %s without changing account data", async (ua) => {
      const result = await request(app).get("/").set("User-Agent", ua).expect(200);
      expect(result.body.data.user.preferences).toEqual({ theme: "sky", language: "ru" });
      expect(result.body.data.tokens).toEqual(payload.data.tokens);
      expect(payload.data.user.preferences.theme).toBe("auto");
    },
  );
  it.each(["Origin", "Sec-Fetch-Mode"])("preserves auto for browser %s", async (header) => {
    const result = await request(app).get("/").set(header, header === "Origin" ? "https://logic-coin.online" : "cors");
    expect(result.body).toEqual(payload);
    expect(result.headers.vary).toContain(header);
  });
  it("handles native clients even with an Origin", async () => {
    const result = await request(app).get("/").set("User-Agent", "okhttp/4.12.0").set("Origin", "null");
    expect(result.body.data.user.preferences.theme).toBe("sky");
  });
  it("defaults unidentified clients to the safe representation", async () => {
    expect((await request(app).get("/")).body.data.user.preferences.theme).toBe("sky");
  });
  it.each(["dark", "light", "sky"])("retains explicit %s", (theme) => {
    const body = { data: { preferences: { theme } } };
    expect(legacyThemePayload(body)).toEqual(body);
  });
  it("serializes subdocuments without exposing Mongoose internals", () => {
    const preferences = { theme: "auto", internal: "not public", toJSON: () => ({ theme: "auto", language: "ru" }) };
    expect(legacyThemePayload({ data: { preferences } }))
      .toEqual({ data: { preferences: { theme: "sky", language: "ru" } } });
  });
  it.each(["auto", "autumn", null, undefined])("normalizes unsupported %s on preferences endpoints", (theme) => {
    expect(legacyThemePayload({ data: { preferences: { theme, language: "uz" } } }))
      .toEqual({ data: { preferences: { theme: "sky", language: "uz" } } });
  });
  it.each([null, [], { error: { code: "unauthorized" } }, { data: { status: "pending" } }])(
    "leaves non-profile payloads intact", (body) => expect(legacyThemePayload(body)).toEqual(body),
  );
});
