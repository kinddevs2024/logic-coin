import express from "express";
import request from "supertest";
import { expect, it, vi } from "vitest";
vi.mock("node:fs/promises", async importOriginal => ({ ...await importOriginal<typeof import("node:fs/promises")>(), readFile: vi.fn(async () => '<html><head><title>Old</title></head><body>App</body></html>') }));
vi.mock("../src/middleware/database.js", () => ({ requireDatabase: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../src/models/User.js", () => ({ User: { findOne: () => ({ select: () => ({ lean: async () => ({ name: "InviteUser" }) }) }) } }));
import shareRoutes from "../src/routes/share.routes.js";
const app = express(); app.use("/", shareRoutes);
it.each(["ru", "en", "uz"])("keeps %s in the invitation's canonical URL and preview", async language => {
  for (const query of [`lang=${language}`, `preview=3&lang=${language}`]) {
    const response = await request(app).get(`/page/invite/TEST-CODE?${query}`).expect(200);
    const html = response.text;
    expect(html).toContain(`lang=${language}`);
    expect(html).toContain(`/platform/${language}.jpg`);
    const title = /<title>(.*?)<\/title>/.exec(html)?.[1];
    expect(Boolean(title && /[А-Яа-я]/.test(title))).toBe(language === "ru");
    const canonical = /rel="canonical" href="([^"]+)"/.exec(html)?.[1]?.replace(/&amp;/g, "&");
    expect(new URL(canonical!).searchParams.get("lang")).toBe(language);
    expect(new URL(canonical!).pathname).toBe("/invite/TEST-CODE");
  }
});
