import { Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { DeviceSecurity } from "../models/DeviceSecurity.js";
import { RefreshSession } from "../models/RefreshSession.js";
import { User } from "../models/User.js";

const MAX_ACCOUNTS_PER_DEVICE = 3;

function normalizedDeviceId(deviceId?: string) {
  const value = deviceId?.trim();
  return value && value.length <= 160 ? value : null;
}

function includesId(values: unknown[], userId: Types.ObjectId) {
  return values.some((value) => String(value) === userId.toString());
}

export async function assertDeviceNotBanned(rawDeviceId?: string) {
  const deviceId = normalizedDeviceId(rawDeviceId);
  if (!deviceId) return;
  const banned = await DeviceSecurity.exists({ deviceId, bannedAt: { $exists: true } });
  if (banned) {
    throw new ApiError(403, "device_banned", "This device is blocked. Contact support or an administrator.");
  }
}

export async function assertDeviceAccess(userId: Types.ObjectId, rawDeviceId?: string) {
  const deviceId = normalizedDeviceId(rawDeviceId);
  if (!deviceId) return;
  const now = new Date();
  const record = await DeviceSecurity.findOneAndUpdate(
    { deviceId },
    { $setOnInsert: { deviceId, accountIds: [], registeredAccountIds: [] }, $set: { lastSeenAt: now } },
    { new: true, upsert: true }
  );
  if (record.bannedAt) {
    throw new ApiError(403, "device_banned", "This device is blocked. Contact support or an administrator.");
  }
  if (includesId(record.accountIds as unknown[], userId)) return;
  if ((record.accountIds?.length ?? 0) >= MAX_ACCOUNTS_PER_DEVICE) {
    throw new ApiError(403, "device_account_limit", "This device can only be used with three accounts");
  }
  await DeviceSecurity.updateOne({ _id: record._id, bannedAt: { $exists: false } }, { $addToSet: { accountIds: userId }, $set: { lastSeenAt: now } });
}

export async function registerDeviceAccount(userId: Types.ObjectId, rawDeviceId?: string) {
  const deviceId = normalizedDeviceId(rawDeviceId);
  if (!deviceId) return;
  const now = new Date();
  const record = await DeviceSecurity.findOneAndUpdate(
    { deviceId },
    { $setOnInsert: { deviceId, accountIds: [], registeredAccountIds: [] }, $set: { lastSeenAt: now } },
    { new: true, upsert: true }
  );
  if (record.bannedAt) {
    throw new ApiError(403, "device_banned", "This device is blocked. Contact support or an administrator.");
  }
  if (!includesId(record.registeredAccountIds as unknown[], userId) && (record.registeredAccountIds?.length ?? 0) >= MAX_ACCOUNTS_PER_DEVICE) {
    await DeviceSecurity.updateOne(
      { _id: record._id },
      { $set: { bannedAt: now, banReason: "registration_limit", lastSeenAt: now }, $addToSet: { accountIds: userId, registeredAccountIds: userId } }
    );
    await RefreshSession.updateMany({ deviceId, revokedAt: { $exists: false } }, { $set: { revokedAt: now, revokeReason: "device_banned" } });
    throw new ApiError(403, "device_banned", "This device was blocked after registering more than three accounts");
  }
  await DeviceSecurity.updateOne(
    { _id: record._id, bannedAt: { $exists: false } },
    { $addToSet: { accountIds: userId, registeredAccountIds: userId }, $set: { lastSeenAt: now } }
  );
}

export async function listBannedDevices() {
  const records = await DeviceSecurity.find({ bannedAt: { $exists: true } }).sort({ bannedAt: -1 }).lean();
  const userIds = [...new Set(records.flatMap((record) => (record.accountIds ?? []).map(String)))];
  const users = await User.find({ _id: { $in: userIds } }).select("name email").lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), { id: user._id.toString(), name: user.name, email: user.email }]));
  return records.map((record) => ({
    id: record._id.toString(),
    deviceId: record.deviceId,
    reason: record.banReason ?? "manual",
    bannedAt: record.bannedAt?.toISOString() ?? null,
    lastSeenAt: record.lastSeenAt.toISOString(),
    accountCount: record.accountIds?.length ?? 0,
    registrationCount: record.registeredAccountIds?.length ?? 0,
    users: (record.accountIds ?? []).flatMap((id) => {
      const user = usersById.get(String(id));
      return user ? [user] : [];
    })
  }));
}

export async function unbanDevice(deviceId: string, adminId: Types.ObjectId) {
  const record = await DeviceSecurity.findOneAndUpdate(
    { deviceId, bannedAt: { $exists: true } },
    {
      $unset: { bannedAt: 1, banReason: 1 },
      $set: { unbannedAt: new Date(), unbannedBy: adminId, accountIds: [], registeredAccountIds: [] }
    },
    { new: true }
  );
  if (!record) throw new ApiError(404, "banned_device_not_found", "Blocked device was not found");
  return { deviceId: record.deviceId, unbannedAt: record.unbannedAt?.toISOString() ?? null };
}
