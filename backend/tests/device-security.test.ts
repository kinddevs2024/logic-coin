import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ exists: vi.fn(), updateOne: vi.fn(), findOneAndUpdate: vi.fn(), find: vi.fn() }));
vi.mock("../src/models/DeviceSecurity.js", () => ({ DeviceSecurity: mocks }));
vi.mock("../src/models/User.js", () => ({ User: { find: () => ({ select: () => ({ lean: async () => [] }) }) } }));
import { assertDeviceAccess, assertDeviceNotBanned, listBannedDevices, registerDeviceAccount, resetDevice, unbanDevice } from "../src/services/device-security.service.js";

describe("device account protection", () => {
  it("fully resets only device bindings and restores the default capacity", async () => {
    mocks.findOneAndUpdate.mockResolvedValue({ deviceId: "device" });
    const adminId = new Types.ObjectId();
    await expect(resetDevice("device", adminId)).resolves.toEqual({ deviceId: "device", accountLimit: 3 });
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith({ deviceId: "device" }, {
      $set: { accountIds: [], registeredAccountIds: [], accountLimit: 3, unbannedAt: expect.any(Date), unbannedBy: adminId },
      $unset: { bannedAt: 1, banReason: 1 }
    }, { new: true });
  });

  it("reports a missing device without creating a record", async () => {
    mocks.findOneAndUpdate.mockResolvedValue(null);
    await expect(resetDevice("missing", new Types.ObjectId())).rejects.toMatchObject({ code: "device_not_found" });
  });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mocks.exists.mockResolvedValue(false);
  });

  it("rejects an additional account without admitting it or revoking existing sessions", async () => {
    mocks.findOneAndUpdate.mockResolvedValue(null);
    await expect(assertDeviceAccess(new Types.ObjectId(), "device")).rejects.toMatchObject({ code: "device_account_limit" });
    expect(mocks.findOneAndUpdate.mock.calls[0]![0].$and[1].$or[1].$expr.$lt).toEqual([
      { $size: { $ifNull: ["$accountIds", []] } }, { $ifNull: ["$accountLimit", 3] }
    ]);
  });

  it("uses the same atomic capacity gate for registration", async () => {
    mocks.findOneAndUpdate.mockResolvedValue(null);
    await expect(registerDeviceAccount(new Types.ObjectId(), "device")).rejects.toMatchObject({ code: "device_account_limit" });
  });

  it("lets an existing account pass independently of capacity and legacy automatic bans", async () => {
    const id = new Types.ObjectId();
    mocks.findOneAndUpdate.mockResolvedValue({ accountIds: [id] });
    await expect(assertDeviceAccess(id, "device")).resolves.toBeUndefined();
    const filter = mocks.findOneAndUpdate.mock.calls[0]![0];
    expect(filter.$and[1].$or[0]).toEqual({ accountIds: id });
    expect(filter.$and[0].$or[1]).toEqual({ banReason: "registration_limit" });
  });

  it("preserves manual bans", async () => {
    mocks.exists.mockResolvedValue(true);
    await expect(assertDeviceNotBanned("device")).rejects.toMatchObject({ code: "device_banned" });
    expect(mocks.exists).toHaveBeenCalledWith(expect.objectContaining({ banReason: { $ne: "registration_limit" } }));
  });

  it("adds exactly one slot without clearing account history", async () => {
    mocks.findOneAndUpdate.mockResolvedValue({ deviceId: "device" });
    await unbanDevice("device", new Types.ObjectId());
    const [filter, pipeline] = mocks.findOneAndUpdate.mock.calls[0]!;
    expect(filter.$or[1].$expr.$gte).toBeDefined();
    expect(pipeline[0].$set.accountLimit.$add[1]).toBe(1);
    expect(pipeline[0].$set.accountIds).toBeUndefined();
    expect(pipeline[0].$set.registeredAccountIds).toBeUndefined();
  });

  it("does not grant another slot when the device is already unlocked", async () => {
    mocks.findOneAndUpdate.mockResolvedValue(null);
    await expect(unbanDevice("device", new Types.ObjectId())).rejects.toMatchObject({ code: "banned_device_not_found" });
  });

  it("handles concurrent device creation", async () => {
    mocks.updateOne.mockRejectedValue({ code: 11000 });
    mocks.findOneAndUpdate.mockResolvedValue({});
    await expect(assertDeviceAccess(new Types.ObjectId(), "device")).resolves.toBeUndefined();
  });

  it("lists devices at capacity even without a historical ban", async () => {
    mocks.find.mockReturnValue({ sort: () => ({ lean: async () => [{
      _id: new Types.ObjectId(), deviceId: "device", lastSeenAt: new Date(),
      accountIds: [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()], registeredAccountIds: []
    }] }) });
    const result = await listBannedDevices();
    expect(mocks.find.mock.calls[0]![0].$or[1].$expr.$gte).toBeDefined();
    expect(result[0]).toMatchObject({ reason: "registration_limit", accountCount: 3 });
  });
});
