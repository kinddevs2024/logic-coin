import express from "express";
import request from "supertest";
import { Types } from "mongoose";
import { beforeEach, expect, it, vi } from "vitest";
import { hashOpaqueToken } from "../src/lib/crypto.js";

const f = vi.hoisted(() => ({
  findById: vi.fn(), update: vi.fn(), create: vi.fn(), findChallenge: vi.fn(), remove: vi.fn(),
  tokens: vi.fn(), device: vi.fn(), hash: vi.fn(), google: vi.fn(), poll: vi.fn(), resume: vi.fn(), mini: vi.fn(), verifyMini: vi.fn()
}));
vi.mock("../src/models/User.js", () => ({ User: { findById: f.findById, findOneAndUpdate: f.update } }));
vi.mock("../src/models/PasswordSetupChallenge.js", () => ({ PasswordSetupChallenge: { create: f.create, findOne: f.findChallenge, deleteMany: f.remove } }));
vi.mock("../src/services/device-security.service.js", () => ({ assertDeviceAccess: f.device, assertDeviceNotBanned: vi.fn(), registerDeviceAccount: vi.fn() }));
vi.mock("../src/services/serialization.service.js", () => ({ serializeUser: (user: any) => ({ id: String(user._id), email: user.email }) }));
vi.mock("../src/services/token.service.js", () => ({ issueTokenPair: f.tokens, revokeAllUserSessions: vi.fn(), revokeRefreshToken: vi.fn(), revokeSessionById: vi.fn(), rotateRefreshToken: vi.fn() }));
vi.mock("../src/services/social-auth.service.js", () => ({ authenticateGoogle: f.google }));
vi.mock("../src/services/telegram-auth.service.js", () => ({
  pollTelegramLogin: f.poll, completeTelegramResume: f.resume, authenticateTelegram: f.mini, verifyTelegramMiniApp: f.verifyMini,
  assertTelegramWebhookSecret: vi.fn(), confirmTelegramBotUpdate: vi.fn(), createTelegramLogin: vi.fn()
}));
vi.mock("bcryptjs", () => ({ default: { hash: f.hash, compare: vi.fn() } }));
import authRoutes from "../src/routes/auth.routes.js";
import { completeSocialSignIn, setSocialPassword } from "../src/services/social-password.service.js";

const app = express(); app.use(express.json()); app.use(authRoutes);
app.use((error: any, _request: any, response: any, _next: any) => response.status(error.statusCode ?? 500).json({ error: { code: error.code } }));
const userId = new Types.ObjectId();
let user: any;
beforeEach(() => {
  user = { _id: userId, email: "person@example.com", emailVerifiedAt: new Date(), name: "Player", username: "player", providers: {}, save: vi.fn() };
  f.findById.mockImplementation(() => ({ select: async () => user }));
  f.create.mockResolvedValue({}); f.remove.mockResolvedValue({}); f.hash.mockResolvedValue("password-hash");
  f.tokens.mockResolvedValue({ accessToken: "access", refreshToken: "refresh" });
  f.google.mockImplementation(async () => ({ user, created: false }));
  f.poll.mockImplementation(async () => user); f.resume.mockImplementation(async () => user); f.mini.mockImplementation(async () => user);
  f.findChallenge.mockResolvedValue({ userId, deviceId: "device-a" }); f.update.mockImplementation(async () => user);
});

it.each([
  ["/google", { idToken: "g".repeat(120) }],
  ["/telegram/status", { flowId: "f".repeat(24), pollToken: "p".repeat(40) }],
  ["/telegram/complete", { resumeToken: "r".repeat(40) }],
  ["/telegram/mini-app", { initData: "i".repeat(40) }]
])("%s requires setup after verified provider proof and issues no session", async (path, body) => {
  const result = await request(app).post(path).send({ ...body, deviceId: "device-a" }).expect(200);
  expect(result.body.data).toMatchObject({ status: "password_setup_required", accountLabel: "@player" });
  expect(result.body.data.setupToken.length).toBeGreaterThanOrEqual(32);
  expect(result.body.data.tokens).toBeUndefined(); expect(f.tokens).not.toHaveBeenCalled();
  expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ userId, tokenHash: hashOpaqueToken(result.body.data.setupToken), deviceId: "device-a" }));
});

it("reads the hidden password field and retains ordinary sign-in for existing passwords", async () => {
  user.passwordHash = "existing";
  const result = await completeSocialSignIn(userId, { deviceId: "device-a" });
  expect(result).toHaveProperty("tokens.accessToken", "access"); expect(f.create).not.toHaveBeenCalled();
  expect(f.findById).toHaveBeenCalledWith(userId);
});
it("provider verification failures cannot create setup proofs or sessions", async () => {
  f.google.mockRejectedValueOnce(new Error("invalid provider proof"));
  await request(app).post("/google").send({ idToken: "g".repeat(120) }).expect(500);
  expect(f.create).not.toHaveBeenCalled(); expect(f.tokens).not.toHaveBeenCalled();
});
it("pending Telegram login cannot start password setup", async () => {
  f.poll.mockResolvedValueOnce(null);
  const result = await request(app).post("/telegram/status").send({ flowId: "f".repeat(24), pollToken: "p".repeat(40) }).expect(202);
  expect(result.body.data.status).toBe("pending"); expect(f.create).not.toHaveBeenCalled();
});
it("creates a password atomically for the proof's account and then grants the session", async () => {
  const result = await request(app).post("/social/set-password").send({ password: "new-password", setupToken: "s".repeat(40), deviceId: "device-a" }).expect(200);
  expect(result.body.data.tokens.accessToken).toBe("access");
  expect(f.findChallenge).toHaveBeenCalledWith({ tokenHash: hashOpaqueToken("s".repeat(40)), expiresAt: { $gt: expect.any(Date) } });
  expect(f.update).toHaveBeenCalledWith({ _id: userId, emailVerifiedAt: { $exists: true }, passwordHash: { $in: [null, ""] } }, { $set: { passwordHash: "password-hash", lastLoginAt: expect.any(Date) } }, { new: true });
  expect(f.remove).toHaveBeenCalledWith({ userId });
});
it("rejects missing, expired or wrong-device proofs without issuing a session", async () => {
  f.findChallenge.mockResolvedValueOnce(null);
  await expect(setSocialPassword("new-password", "s".repeat(40), { deviceId: "device-a" })).rejects.toMatchObject({ code: "invalid_password_setup" });
  await expect(setSocialPassword("new-password", "s".repeat(40), { deviceId: "device-b" })).rejects.toMatchObject({ code: "invalid_password_setup" });
  expect(f.update).not.toHaveBeenCalled(); expect(f.tokens).not.toHaveBeenCalled();
});
it("never replaces an existing password when proofs are replayed or submitted concurrently", async () => {
  f.update.mockResolvedValueOnce(null);
  await expect(setSocialPassword("new-password", "s".repeat(40), { deviceId: "device-a" })).rejects.toMatchObject({ code: "invalid_password_setup" });
  expect(f.tokens).not.toHaveBeenCalled();
});
it("checks device restrictions before accepting the password", async () => {
  f.device.mockRejectedValueOnce(new Error("blocked device"));
  await expect(setSocialPassword("new-password", "s".repeat(40), { deviceId: "device-a" })).rejects.toThrow("blocked device");
  expect(f.update).not.toHaveBeenCalled(); expect(f.tokens).not.toHaveBeenCalled();
});
it("rejects short passwords and client-selected account identifiers", async () => {
  await request(app).post("/social/set-password").send({ password: "short", setupToken: "s".repeat(40) }).expect(400);
  await request(app).post("/social/set-password").send({ password: "long-password", setupToken: "s".repeat(40), email: "victim@example.com" }).expect(400);
  expect(f.update).not.toHaveBeenCalled();
});
