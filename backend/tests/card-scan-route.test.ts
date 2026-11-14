import express from "express";
import request from "supertest";
import { Types } from "mongoose";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ scan: vi.fn().mockResolvedValue({ number: "4242424242424242" }), create: vi.fn(), add: vi.fn() }));
vi.mock("../src/services/card-scan.service.js", () => ({ scanCardPhoto: mocks.scan }));
vi.mock("../src/services/withdrawal.service.js", () => ({ createSandboxWithdrawal: mocks.create, addWithdrawalCard: mocks.add }));
import withdrawalRoutes from "../src/routes/withdrawals.routes.js";
import { errorHandler } from "../src/middleware/errors.js";
describe("card scan route", () => {
  const app = express();
  app.use(express.json({ limit: "3mb" }));
  const userId = new Types.ObjectId();
  app.use((req, res, next) => {
    if (!req.header("Authorization")) { res.sendStatus(401); return; }
    req.auth = { userId, sessionId: new Types.ObjectId().toString() }; next();
  });
  app.use("/withdrawals", withdrawalRoutes); app.use(errorHandler);
  it("requires authentication and never creates a payout when scanning", async () => {
    await request(app).post("/withdrawals/scan-card").send({ base64: "aGVsbG8=" }).expect(401);
    const result = await request(app).post("/withdrawals/scan-card").set("Authorization", "Bearer fixture").send({ base64: "aGVsbG8=" }).expect(200);
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.body).toEqual({ data: { number: "4242424242424242" } });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.add).not.toHaveBeenCalled();
  });
  it("rejects invalid and excessive uploads without passing them to OCR", async () => {
    const before = mocks.scan.mock.calls.length;
    for (const body of [{ base64: "../etc" }, { base64: "A".repeat(2000004) }, { base64: "aGVsbG8=", extra: "no" }]) {
      await request(app).post("/withdrawals/scan-card").set("Authorization", "Bearer fixture").send(body).expect(400);
    }
    expect(mocks.scan.mock.calls.length).toBe(before);
  });
  it("bounds repeated scans independently of withdrawal submission limits", async () => {
    for (let i = 0; i < 8; i += 1) await request(app).post("/withdrawals/scan-card").set("Authorization", "Bearer fixture").send({ base64: "aGVsbG8=" }).expect(200);
    const limited = await request(app).post("/withdrawals/scan-card").set("Authorization", "Bearer fixture").send({ base64: "aGVsbG8=" }).expect(429);
    expect(limited.headers["cache-control"]).toBe("no-store");
  });
});
