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
    deviceMocks.exists.mockResolvedValue(null);
    refreshMocks.updateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  it("rejects a fourth distinct account on the same device", async () => {
    deviceMocks.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      assertDeviceAccess(new Types.ObjectId(), "device-1"),
    ).rejects.toMatchObject({ statusCode: 403, code: "device_account_limit" });
    expect(deviceMocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: "device-1", $and: expect.any(Array) }),
      expect.objectContaining({ $addToSet: expect.objectContaining({ accountIds: expect.anything() }) }),
      { new: true },
    );
  });

  it("rejects another registration at capacity without revoking existing accounts", async () => {
    deviceMocks.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      registerDeviceAccount(new Types.ObjectId(), "device-2"),
    ).rejects.toMatchObject({ statusCode: 403, code: "device_account_limit" });
    expect(refreshMocks.updateMany).not.toHaveBeenCalled();
  });

  it("adds one account slot without clearing history when an administrator unblocks a device", async () => {
    const unbannedAt = new Date();
    deviceMocks.findOneAndUpdate.mockResolvedValue({
      deviceId: "device-3",
      unbannedAt,
    });

    await expect(
      unbanDevice("device-3", new Types.ObjectId()),
    ).resolves.toEqual({ deviceId: "device-3", unbannedAt: unbannedAt.toISOString() });
    expect(deviceMocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: "device-3", $or: expect.any(Array) }),
      [expect.objectContaining({ $set: expect.objectContaining({ accountLimit: expect.any(Object), bannedAt: "$$REMOVE" }) })],
      { new: true },
    );
  });
  it("allows an already admitted account", async () => {
    deviceMocks.findOneAndUpdate.mockResolvedValue({ accountIds: [new Types.ObjectId()] });
    await expect(assertDeviceAccess(new Types.ObjectId(), "existing")).resolves.toBeUndefined();
  });
  it("keeps a manual device ban enforced", async () => {
    deviceMocks.findOneAndUpdate.mockResolvedValue(null);
    deviceMocks.exists.mockResolvedValue({ _id: new Types.ObjectId() });
    await expect(assertDeviceAccess(new Types.ObjectId(), "manual")).rejects.toMatchObject({ statusCode: 403, code: "device_banned" });
  });
});
