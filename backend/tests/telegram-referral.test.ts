import mongoose, { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findOne: vi.fn(), createUser: vi.fn(), processReferralSignupReward: vi.fn() }));
vi.mock("../src/models/User.js", () => ({ User: { findOne: mocks.findOne } }));
vi.mock("../src/services/user.service.js", () => ({ createUser: mocks.createUser, processReferralSignupReward: mocks.processReferralSignupReward }));
import { authenticateTelegram } from "../src/services/telegram-auth.service.js";
describe("Telegram referral registration", () => {
  const user = { _id: new Types.ObjectId(), save: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    const session = { withTransaction: async (callback: () => Promise<void>) => callback(), endSession: vi.fn() };
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session as never);
    mocks.createUser.mockResolvedValue(user);
  });
  it("binds invitation and processes signup reward only when creating an account", async () => {
    mocks.findOne.mockResolvedValue(null);
    await authenticateTelegram({ id: "123", firstName: "Friend" }, "INVITER");
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({ referralCode: "INVITER", telegramSub: "123" }));
    expect(mocks.processReferralSignupReward).toHaveBeenCalledOnce();
  });
  it("never assigns or replaces an inviter for an existing account, including self links", async () => {
    mocks.findOne.mockResolvedValue(user);
    await authenticateTelegram({ id: "123", firstName: "Friend" }, "OWN-CODE");
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.processReferralSignupReward).not.toHaveBeenCalled();
  });
  it("keeps organic registrations unassigned", async () => {
    mocks.findOne.mockResolvedValue(null);
    await authenticateTelegram({ id: "456", firstName: "Organic" });
    expect(mocks.createUser).toHaveBeenCalledWith(expect.not.objectContaining({ referralCode: expect.anything() }));
  });
});
