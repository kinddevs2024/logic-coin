import express from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import { loginIdentifierSchema, loginIdentityFilter } from "../src/lib/login-identifier.js";
const fixture = vi.hoisted(() => ({ user: null as any, findOne: vi.fn(), updateOne: vi.fn(), otp: vi.fn(), compare: vi.fn(), tokens: vi.fn() }));
vi.mock("../src/models/User.js", () => ({ User: { findOne: fixture.findOne, updateOne: fixture.updateOne } }));
vi.mock("../src/services/device-security.service.js", () => ({ assertDeviceNotBanned: vi.fn(), registerDeviceAccount: vi.fn() }));
vi.mock("../src/services/otp.service.js", () => ({ createAndSendOtp: fixture.otp, consumeOtp: vi.fn() }));
vi.mock("../src/services/token.service.js", () => ({ issueTokenPair: fixture.tokens, revokeAllUserSessions: vi.fn(), revokeRefreshToken: vi.fn(), revokeSessionById: vi.fn(), rotateRefreshToken: vi.fn() }));
vi.mock("bcryptjs", () => ({ default: { compare: fixture.compare, hash: vi.fn() } }));
import authRoutes from "../src/routes/auth.routes.js";
const app = express(); app.use(express.json()); app.use(authRoutes);
app.use((error: any, _request: any, response: any, _next: any) => response.status(error.statusCode ?? 500).json({error:{code:error.code}}));
beforeEach(() => {
  fixture.user = { _id: "012345678901234567890123", email: "private@example.com", emailVerifiedAt: new Date(), passwordHash: "hash", save: vi.fn() };
  fixture.findOne.mockImplementation(() => ({ select: async () => fixture.user }));
  fixture.otp.mockResolvedValue({delivery:"sent"});
  fixture.compare.mockResolvedValue(false);
});
it("normalizes nickname and email without accepting query operators", () => {
  expect(loginIdentityFilter(loginIdentifierSchema.parse(" @Some_user "))).toEqual({username:"some_user"});
  expect(loginIdentityFilter(loginIdentifierSchema.parse(" PERSON@example.com "))).toEqual({email:"person@example.com"});
  expect(loginIdentifierSchema.safeParse({$ne:null}).success).toBe(false);
  expect(loginIdentifierSchema.safeParse("@a.*").success).toBe(false);
});
it("offers password sign-in without revealing the nickname owner's email", async () => {
  const result = await request(app).post("/email/start").send({email:"@Some_user"}).expect(200);
  expect(result.body.data).toEqual({email:"@some_user",mode:"password"});
  expect(fixture.findOne).toHaveBeenCalledWith({username:"some_user"});
  expect(fixture.otp).not.toHaveBeenCalled();
});
it("requires the account password instead of authenticating by nickname alone", async () => {
  await request(app).post("/login").send({email:"@Some_user",password:"wrong-password"}).expect(401);
  expect(fixture.compare).toHaveBeenCalledWith("wrong-password","hash");
  expect(fixture.tokens).not.toHaveBeenCalled();
});
it("sends verification only to the account's stored email", async () => {
  fixture.user.passwordHash = undefined;
  const result = await request(app).post("/email/start").send({email:"@Some_user"}).expect(202);
  expect(fixture.otp).toHaveBeenCalledWith("private@example.com",expect.any(String));
  expect(result.body.data.email).toBe("@some_user");
});
it("never sends email to a synthetic Telegram address", async () => {
  fixture.user.email = "telegram-123456@telegram.logiccoin.local";
  await request(app).post("/email/start").send({email:"@Some_user"}).expect(400);
  expect(fixture.otp).not.toHaveBeenCalled();
});
it("resends a code to the account email without exposing it", async () => {
  fixture.user.passwordHash = undefined;
  const result = await request(app).post("/email/resend").send({email:"@Some_user"}).expect(202);
  expect(fixture.otp).toHaveBeenCalledWith("private@example.com",expect.any(String));
  expect(result.body.data.email).toBe("@some_user");
});
it("does not create a new account for an unknown nickname", async () => {
  fixture.user = null;
  await request(app).post("/email/start").send({email:"@Missing_user"}).expect(401);
  expect(fixture.otp).not.toHaveBeenCalled();
});
