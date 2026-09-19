import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ challenge: vi.fn(), user: vi.fn(), access: vi.fn() }));
vi.mock("../src/models/TelegramLoginChallenge.js", () => ({ TelegramLoginChallenge: { findOneAndUpdate: mocks.challenge } }));
vi.mock("../src/models/User.js", () => ({ User: { findOne: mocks.user } }));
vi.mock("../src/services/device-security.service.js", () => ({ assertDeviceAccess: mocks.access }));
import { completeTelegramResume } from "../src/services/telegram-auth.service.js";

describe("Telegram originating device limit", () => {
  const user = { _id: new Types.ObjectId(), save: vi.fn() };
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.challenge.mockResolvedValue({ telegramUser: { id: "123", firstName: "Test" }, deviceId: "origin-apk" });
    mocks.user.mockResolvedValue(user);
  });
  it("checks the APK device even when completing in a different browser", async () => {
    await expect(completeTelegramResume("test-resume-token")).resolves.toBe(user);
    expect(mocks.access).toHaveBeenCalledWith(user._id, "origin-apk");
  });
  it("does not return an authenticated user when the originating device is full", async () => {
    mocks.access.mockRejectedValue(Object.assign(new Error("Account limit"), { code: "device_account_limit" }));
    await expect(completeTelegramResume("test-resume-token")).rejects.toMatchObject({ code: "device_account_limit" });
  });
});
