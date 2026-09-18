import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findOne: vi.fn(), create: vi.fn() }));
vi.mock("../src/models/User.js", () => ({ User: mocks }));
import { createUser } from "../src/services/user.service.js";
describe("referral account relationship", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.create.mockImplementation(async value => value); });
  it("stores the inviter ID used by the friends list", async () => {
    const inviterId = new Types.ObjectId();
    mocks.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: inviterId }) });
    const user = await createUser({ email: "new@example.com", name: "New", referralCode: " inviter " });
    expect(mocks.findOne).toHaveBeenCalledWith({ referralCode: "INVITER" });
    expect(user.referredBy).toEqual(inviterId);
  });
  it("does not invent a referrer for organic or invalid invitations", async () => {
    mocks.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
    const organic = await createUser({ email: "organic@example.com", name: "Organic" });
    const invalid = await createUser({ email: "invalid@example.com", name: "Invalid", referralCode: "UNKNOWN" });
    expect(organic).not.toHaveProperty("referredBy");
    expect(invalid).not.toHaveProperty("referredBy");
  });
});
