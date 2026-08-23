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

vi.mock("../src/services/withdrawal.service.js", () => ({
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

  it("accepts only truncated card data", async () => {
    await request(app).post("/").send(validBody).expect(201);
    expect(mocks.createWithdrawal).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      card: validBody.card,
      agreementVersion: "2026-08-23"
    }));
  });

  it("rejects a full PAN field at the API boundary", async () => {
    await request(app).post("/").send({
      ...validBody,
      card: { ...validBody.card, cardNumber: "4242424242424242" }
    }).expect(400);
    expect(mocks.createWithdrawal).not.toHaveBeenCalled();
  });
});
