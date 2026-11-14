import express from "express";
import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWithdrawal: vi.fn(),
  notifyAdmin: vi.fn(),
  userFindById: vi.fn(),
  withdrawalFind: vi.fn()
}));

vi.mock("../src/middleware/rate-limits.js", () => ({
  withdrawalLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("../src/services/withdrawal.service.js", () => ({
  addWithdrawalCard: vi.fn(),
  createSandboxWithdrawal: mocks.createWithdrawal
}));
vi.mock("../src/services/telegram.service.js", () => ({
  notifyWithdrawalAdmin: mocks.notifyAdmin
}));
vi.mock("../src/models/User.js", () => ({ User: { findById: mocks.userFindById } }));
vi.mock("../src/models/Withdrawal.js", () => ({ Withdrawal: { find: mocks.withdrawalFind } }));

import withdrawalRoutes from "../src/routes/withdrawals.routes.js";

describe("withdrawal card boundary", () => {
  const userId = new Types.ObjectId();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = { userId, sessionId: new Types.ObjectId().toString() };
    next();
  });
  app.use("/", withdrawalRoutes);
  app.use((error: { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(error.statusCode ?? 500).json({ error: { code: error.code ?? "internal_error" } });
  });

  beforeEach(() => {
    mocks.createWithdrawal.mockReset();
    mocks.notifyAdmin.mockReset();
    mocks.createWithdrawal.mockResolvedValue({
      withdrawal: {
        _id: new Types.ObjectId(),
        amountCents: 1_000,
        amountUnits: 1_000,
        method: "bank_card",
        accountLabel: "VISA •••• 4242",
        cardBrand: "visa",
        cardLast4: "4242",
        status: "pending_review",
        requestedAt: new Date("2026-08-23T12:00:00.000Z")
      },
      wallet: { availableUnits: 0, lockedUnits: 1_000, lifetimeEarnedUnits: 1_000 },
      idempotentReplay: false
    });
    mocks.notifyAdmin.mockResolvedValue("disabled");
  });

  const validBody = {
    amountCents: 1_000,
    method: "bank_card",
    card: { brand: "visa", last4: "4242", holderName: "OLIVIA RHYE", expiration: "06/28" },
    agreementAccepted: true,
    agreementVersion: "2026-08-23",
    idempotencyKey: "withdraw-test-123"
  } as const;

  it("accepts legacy card metadata without passing it to the payout service", async () => {
    await request(app).post("/").send(validBody).expect(201);
    expect(mocks.createWithdrawal).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      card: {brand: "visa", last4: "4242"},
      agreementVersion: "2026-08-23"
    }));
  });

  it("accepts a payout number without returning it or notifying Telegram with it",async()=>{
    const number="4242424242424242";
    const result=await request(app).post("/").send({...validBody,card:{...validBody.card,number}}).expect(201);
    expect(mocks.createWithdrawal).toHaveBeenCalledWith(expect.objectContaining({card:expect.objectContaining({number})}));
    expect(JSON.stringify(result.body)).not.toContain(number);
    expect(JSON.stringify(mocks.notifyAdmin.mock.calls)).not.toContain(number);
  });
  it("accepts a 16-digit number without a name or expiration", async () => {
    await request(app).post("/").send({...validBody, card: {number: "4242424242424242", brand: "visa", last4: "4242"}}).expect(201);
    const card = mocks.createWithdrawal.mock.calls[0]![0].card;
    expect(card).toEqual({number: "4242424242424242", brand: "visa", last4: "4242"});
  });

  it.each(["uzcard", "humo"])("accepts %s metadata", async brand => {
    await request(app).post("/").send({...validBody, card: {brand, last4: "1234"}}).expect(201);
  });

  it.each(["424242424242424", "42424242424242424", "4242424242424242424"])("rejects a PAN with the wrong length: %s", async number => {
    await request(app).post("/").send({...validBody, card: {number, brand: "visa", last4: "4242"}}).expect(400);
    expect(mocks.createWithdrawal).not.toHaveBeenCalled();
  });

  it("accepts a saved card reference without optional fields", async () => {
    const card = {savedWithdrawalId: "0123456789abcdef01234567", brand: "visa", last4: "4242"};
    await request(app).post("/").send({...validBody, card}).expect(201);
    expect(mocks.createWithdrawal.mock.calls[0]![0].card).toEqual(card);
  });

  it("rejects unsupported card fields at the API boundary", async () => {
    await request(app).post("/").send({
      ...validBody,
      card: { ...validBody.card, cardNumber: "4242424242424242" }
    }).expect(400);
    expect(mocks.createWithdrawal).not.toHaveBeenCalled();
  });
});
