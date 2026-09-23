import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findOne, countDocuments } = vi.hoisted(() => ({ findOne: vi.fn(), countDocuments: vi.fn() }));
vi.mock("../src/models/User.js", () => ({ User: { findOne } }));
vi.mock("../src/models/ChallengeAttempt.js", () => ({ ChallengeAttempt: { countDocuments } }));
vi.mock("../src/middleware/database.js", () => ({ requireDatabase: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("node:fs/promises", () => ({ readFile: vi.fn(async () => '<html><head><title>Logic Coin</title></head><body><div id="root"></div></body></html>') }));
import routes from "../src/routes/share.routes.js";

const app = express();
app.use("/share", routes);
describe("public link preview pages", () => {
  beforeEach(() => {
    findOne.mockReturnValue({ select: () => ({ lean: async () => ({ name: 'Alice <script>"', referralCode: "LC1234" }) }) });
  });
  it("serves profile tags without requiring login or executing browser JavaScript", async () => {
    const result = await request(app).get("/share/page/profile/lc1234").set("User-Agent", "TelegramBot");
    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toContain("text/html");
    expect(result.text).toContain("/share/profile/LC1234.jpg");
    expect(result.text).toContain("Alice &lt;script&gt;&quot;");
    expect(result.text).not.toContain("/invite/");
    expect(result.text).toContain('<div id="root"></div>');
  });
  it("keeps an invitation distinct from the profile", async () => {
    const result = await request(app).get("/share/page/invite/LC1234");
    expect(result.status).toBe(200);
    expect(result.text).toContain("/invite/LC1234");
    expect(result.text).toContain("/share/logic-coin-v1.jpg");
    expect(result.text).not.toContain("/share/profile/");
  });
  it("uses the generic image for an unknown account", async () => {
    findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });
    const result = await request(app).get("/share/page/profile/LC4040");
    expect(result.status).toBe(200);
    expect(result.text).toContain("/share/logic-coin-v1.jpg");
    expect(result.text).not.toContain("Alice");
  });
  it("rejects invalid route kinds and untrusted path fragments", async () => {
    expect((await request(app).get("/share/page/admin/LC1234")).status).toBe(404);
    expect((await request(app).get("/share/page/profile/%3Cscript%3E")).status).toBe(404);
  });
});
