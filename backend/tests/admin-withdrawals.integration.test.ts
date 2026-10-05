import mongoose, { Types } from "mongoose";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const identity = vi.hoisted(() => ({ admin: "507f1f77bcf86cd799439011", user: "507f1f77bcf86cd799439012" }));
vi.mock("../src/services/token.service.js", () => ({
  verifyAccessToken: (token: string) => ({ sub: token === "admin" ? identity.admin : identity.user, sid: "507f1f77bcf86cd799439013" }),
  isAccessSessionActive: async () => true,
}));
import { User } from "../src/models/User.js";
import { Withdrawal } from "../src/models/Withdrawal.js";
import { LedgerEntry } from "../src/models/LedgerEntry.js";
import { env } from "../src/config/env.js";
import { centsToUnits } from "../src/lib/money.js";
import { createSandboxWithdrawal } from "../src/services/withdrawal.service.js";
import { listAdminWithdrawals, reviewAdminWithdrawal } from "../src/services/admin-withdrawal.service.js";
import adminWithdrawalRoutes from "../src/routes/admin-withdrawals.routes.js";

const uri = process.env.QA_MONGODB_URI;
describe.skipIf(!uri)("admin withdrawal processing, isolated MongoDB", () => {
  const adminId = new Types.ObjectId(identity.admin), userId = new Types.ObjectId(identity.user);
  const amountCents = Math.max(1000, env.MIN_WITHDRAWAL_CENTS);
  const units = centsToUnits(amountCents);
  const app = express(); app.use(express.json()); app.use("/withdrawals", adminWithdrawalRoutes);
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(error.statusCode ?? 500).json({ error: { code: error.code, message: error.message } }); });
  beforeAll(async () => {
    if (!uri?.startsWith("mongodb://127.0.0.1:27938/")) throw Error("Only isolated QA MongoDB is permitted");
    await mongoose.connect(uri, { dbName: `logic_coin_qa_withdrawals_${Date.now()}` });
    await Promise.all([User.init(), Withdrawal.init(), LedgerEntry.init()]);
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Withdrawal.deleteMany({}), LedgerEntry.deleteMany({})]);
    await User.create([
      { _id: adminId, name: "QA Admin", email: "qa-admin@example.invalid", referralCode: "QAWITHDRAWADMIN", role: "admin" },
      { _id: userId, name: "QA User", email: "qa-user@example.invalid", referralCode: "QAWITHDRAWUSER", wallet: { availableUnits: units * 5 } },
    ]);
  });
  afterAll(async () => { await mongoose.disconnect(); });
  const create = (key = "qa-withdraw-1") => createSandboxWithdrawal({ userId, amountCents, idempotencyKey: key, card: { brand: "visa", last4: "1234", holderName: "QA User", expiration: "12/30" }, agreementVersion: "2026-08-23" });
  const review = (id: string, action: "approve" | "reject" | "mark_paid", expectedVersion = 0) => reviewAdminWithdrawal({ id, action, expectedVersion, adminId, note: "QA decision", paymentReference: "QA-TRANSFER-1", paymentConfirmed: true });
  const wallet = async () => (await User.findById(userId).lean())!.wallet;
  it("lists existing reserved requests with masked card data and paginates", async () => {
    await create(); await create("qa-withdraw-2");
    const first = await listAdminWithdrawals({ status: "pending_review", limit: 1 });
    expect(first.withdrawals).toHaveLength(1); expect(first.nextCursor).toBeTruthy();
    expect(first.withdrawals[0]!.accountLabel).toContain("1234");
    expect(first.withdrawals[0]).not.toHaveProperty("cardExpiration");
    const second = await listAdminWithdrawals({ status: "pending_review", limit: 1, before: first.nextCursor! });
    expect(second.withdrawals[0]!.id).not.toBe(first.withdrawals[0]!.id);
    expect(second.nextCursor).toBeNull();
    expect(first.summary.find(s => s.status === "pending_review")?.count).toBe(2);
  });
  it("approves without debiting again; manual payment releases only the reserve", async () => {
    const { withdrawal } = await create(); const id = String(withdrawal._id);
    await review(id, "approve");
    expect(await wallet()).toMatchObject({ availableUnits: units * 4, lockedUnits: units });
    await review(id, "mark_paid", 1);
    expect(await wallet()).toMatchObject({ availableUnits: units * 4, lockedUnits: 0 });
    const result = await Withdrawal.findById(id).lean();
    expect(result!.status).toBe("paid"); expect(result!.reviewHistory).toHaveLength(2);
    expect(result!.paymentReference).toBe("QA-TRANSFER-1");
    await expect(review(id, "mark_paid", 1)).rejects.toMatchObject({ statusCode: 409 });
    expect(await LedgerEntry.countDocuments({ sourceId: `${id}:paid` })).toBe(1);
  });
  it.each([false, true])("rejects and refunds exactly once (approved=%s)", async approved => {
    const { withdrawal } = await create(); const id = String(withdrawal._id);
    if (approved) await review(id, "approve");
    await review(id, "reject", approved ? 1 : 0);
    expect(await wallet()).toMatchObject({ availableUnits: units * 5, lockedUnits: 0 });
    await expect(review(id, "reject", approved ? 1 : 0)).rejects.toMatchObject({ statusCode: 409 });
    expect(await wallet()).toMatchObject({ availableUnits: units * 5, lockedUnits: 0 });
    expect(await LedgerEntry.countDocuments({ sourceId: `${id}:rejected` })).toBe(1);
  });
  it("requires approval, an external reference and explicit payment confirmation", async () => {
    const { withdrawal } = await create(); const id = String(withdrawal._id);
    await expect(review(id, "mark_paid")).rejects.toMatchObject({ statusCode: 409 });
    await expect(reviewAdminWithdrawal({ id, action: "mark_paid", expectedVersion: 0, adminId })).rejects.toMatchObject({ statusCode: 400 });
    await expect(reviewAdminWithdrawal({ id, action: "reject", expectedVersion: 0, adminId })).rejects.toMatchObject({ statusCode: 400 });
    expect((await Withdrawal.findById(id))!.status).toBe("pending_review");
  });
  it("rejects stale revisions", async () => {
    const { withdrawal } = await create(); const id = String(withdrawal._id);
    await review(id, "approve");
    await expect(review(id, "reject", 0)).rejects.toMatchObject({ statusCode: 409 });
    expect(await wallet()).toMatchObject({ availableUnits: units * 4, lockedUnits: units });
  });
  it("allows only one of concurrent payment/rejection decisions", async () => {
    const { withdrawal } = await create(); const id = String(withdrawal._id); await review(id, "approve");
    const attempts = await Promise.allSettled([review(id, "mark_paid", 1), review(id, "reject", 1)]);
    expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const row = await Withdrawal.findById(id).lean();
    expect(await wallet()).toMatchObject({ lockedUnits: 0, availableUnits: units * (row!.status === "paid" ? 4 : 5) });
  });
  it("rolls back status and audit if funds are missing", async () => {
    const { withdrawal } = await create(); const id = String(withdrawal._id);
    await User.updateOne({ _id: userId }, { $set: { "wallet.lockedUnits": 0 } });
    await expect(review(id, "reject")).rejects.toMatchObject({ statusCode: 409 });
    const row = await Withdrawal.findById(id).lean();
    expect(row!.status).toBe("pending_review"); expect(row!.reviewHistory).toHaveLength(0);
    expect((await wallet()).availableUnits).toBe(units * 4);
  });
  it("requires a real reservation ledger entry", async () => {
    const { withdrawal } = await create(); await LedgerEntry.deleteMany({});
    await expect(review(String(withdrawal._id), "reject")).rejects.toMatchObject({ code: "withdrawal_reservation_missing" });
    expect((await wallet()).lockedUnits).toBe(units);
  });
  it("keeps legacy sandbox requests read-only", async () => {
    const { withdrawal } = await create(); await Withdrawal.updateOne({ _id: withdrawal._id }, { $set: { method: "sandbox", status: "sandbox_pending" } });
    await expect(review(String(withdrawal._id), "approve")).rejects.toMatchObject({ statusCode: 409 });
  });
  it("requires administrator authorization for reads and actions", async () => {
    const { withdrawal } = await create();
    await request(app).get("/withdrawals").expect(401);
    await request(app).get("/withdrawals").set("Authorization", "Bearer user").expect(403);
    await request(app).post(`/withdrawals/${withdrawal._id}/review`).set("Authorization", "Bearer user").send({ action: "reject", expectedVersion: 0, note: "invalid access" }).expect(403);
    const response = await request(app).get("/withdrawals").set("Authorization", "Bearer admin").expect(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.data.withdrawals).toHaveLength(1);
    await request(app).get("/withdrawals?limit=10000").set("Authorization", "Bearer admin").expect(400);
    await request(app).post(`/withdrawals/${withdrawal._id}/review`).set("Authorization", "Bearer admin").send({ action: "approve", expectedVersion: 0 }).expect(200);
  });
});
