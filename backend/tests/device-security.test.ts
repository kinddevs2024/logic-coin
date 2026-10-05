import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const deviceMocks = vi.hoisted(() => ({
  exists: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
}));
const refreshMocks = vi.hoisted(() => ({ updateMany: vi.fn() }));

vi.mock("../src/models/DeviceSecurity.js", () => ({ DeviceSecurity: deviceMocks }));
vi.mock("../src/models/RefreshSession.js", () => ({ RefreshSession: refreshMocks }));
vi.mock("../src/models/User.js", () => ({ User: {} }));

import {
  assertDeviceAccess,
  registerDeviceAccount,
  unbanDevice,
} from "../src/services/device-security.service.js";

describe("device account protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deviceMocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
    refreshMocks.updateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  it("rejects a fourth distinct account on the same device", async () => {
    deviceMocks.findOneAndUpdate.mockResolvedValue({
      _id: new Types.ObjectId(),
      accountIds: [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()],
      registeredAccountIds: [],
    });

    await expect(
      assertDeviceAccess(new Types.ObjectId(), "device-1"),
    ).rejects.toMatchObject({ statusCode: 403, code: "device_account_limit" });
    expect(deviceMocks.updateOne).not.toHaveBeenCalled();
  });

  it("permanently blocks a device attempting a fourth registration", async () => {
    deviceMocks.findOneAndUpdate.mockResolvedValue({
      _id: new Types.ObjectId(),
      accountIds: [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()],
      registeredAccountIds: [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()],
    });

    await expect(
      registerDeviceAccount(new Types.ObjectId(), "device-2"),
    ).rejects.toMatchObject({ statusCode: 403, code: "device_banned" });
    expect(deviceMocks.updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: expect.objectContaining({ banReason: "registration_limit" }),
      }),
    );
    expect(refreshMocks.updateMany).toHaveBeenCalledWith(
      { deviceId: "device-2", revokedAt: { $exists: false } },
      { $set: expect.objectContaining({ revokeReason: "device_banned" }) },
    );
  });

  it("clears tracked accounts when an administrator unblocks a device", async () => {
    const unbannedAt = new Date();
    deviceMocks.findOneAndUpdate.mockResolvedValue({
      deviceId: "device-3",
      unbannedAt,
    });

    await expect(
      unbanDevice("device-3", new Types.ObjectId()),
    ).resolves.toEqual({ deviceId: "device-3", unbannedAt: unbannedAt.toISOString() });
    expect(deviceMocks.findOneAndUpdate).toHaveBeenCalledWith(
      { deviceId: "device-3", bannedAt: { $exists: true } },
      expect.objectContaining({
        $set: expect.objectContaining({ accountIds: [], registeredAccountIds: [] }),
      }),
      { new: true },
    );
  });
});
