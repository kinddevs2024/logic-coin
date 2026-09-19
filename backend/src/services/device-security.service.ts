import { Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { DeviceSecurity } from "../models/DeviceSecurity.js";
import { User } from "../models/User.js";

const count = { $size: { $ifNull: ["$accountIds", []] } };
const limit = { $ifNull: ["$accountLimit", 3] };
const atLimit = { $gte: [count, limit] };

function normalizedDeviceId(deviceId?: string) {
  const value = deviceId?.trim();
  return value && value.length <= 160 ? value : null;
}

export async function assertDeviceNotBanned(rawDeviceId?: string) {
  const deviceId = normalizedDeviceId(rawDeviceId);
  if (!deviceId) return;
  if (await DeviceSecurity.exists({ deviceId, bannedAt: { $exists: true }, banReason: { $ne: "registration_limit" } })) {
    throw new ApiError(403, "device_banned", "This device is blocked. Contact support or an administrator.");
  }
}

async function admitAccount(userId: Types.ObjectId, rawDeviceId: string | undefined, registered: boolean) {
  const deviceId = normalizedDeviceId(rawDeviceId);
  if (!deviceId) return;
  const now = new Date();
  try {
    await DeviceSecurity.updateOne({ deviceId }, {
      $setOnInsert: { deviceId, accountIds: [], registeredAccountIds: [], accountLimit: 3 },
      $set: { lastSeenAt: now }
    }, { upsert: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  // Check capacity and consume a slot atomically. Existing accounts need no slot.
  const record = await DeviceSecurity.findOneAndUpdate({
    deviceId,
    $and: [
      { $or: [{ bannedAt: { $exists: false } }, { banReason: "registration_limit" }] },
      { $or: [{ accountIds: userId }, { $expr: { $lt: [count, limit] } }] }
    ]
  }, {
    $addToSet: registered ? { accountIds: userId, registeredAccountIds: userId } : { accountIds: userId },
    $set: { lastSeenAt: now }
  }, { new: true });
  if (!record) {
    await assertDeviceNotBanned(deviceId);
    throw new ApiError(403, "device_account_limit", "This device has reached its account limit. Contact an administrator to allow one more account.");
  }
}

export async function assertDeviceAccess(userId: Types.ObjectId, deviceId?: string) {
  await admitAccount(userId, deviceId, false);
}

export async function registerDeviceAccount(userId: Types.ObjectId, deviceId?: string) {
  await admitAccount(userId, deviceId, true);
}

export async function listBannedDevices() {
  // Existing devices at capacity appear immediately, without a migration.
  const records = await DeviceSecurity.find({ $or: [{ bannedAt: { $exists: true } }, { $expr: atLimit }] }).sort({ lastSeenAt: -1 }).lean();
  const userIds = [...new Set(records.flatMap((record) => (record.accountIds ?? []).map(String)))];
  const users = await User.find({ _id: { $in: userIds } }).select("name email").lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), { id: user._id.toString(), name: user.name, email: user.email }]));
  return records.map((record) => ({
    id: record._id.toString(),
    deviceId: record.deviceId,
    reason: record.banReason ?? (record.bannedAt ? "manual" : "registration_limit"),
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
    { deviceId, $or: [{ bannedAt: { $exists: true } }, { $expr: atLimit }] },
    [{ $set: {
      accountLimit: { $add: [{ $max: [count, limit] }, 1] },
      unbannedAt: new Date(), unbannedBy: adminId,
      bannedAt: "$$REMOVE", banReason: "$$REMOVE"
    } }],
    { new: true }
  );
  if (!record) throw new ApiError(404, "banned_device_not_found", "Blocked device was not found");
  return { deviceId: record.deviceId, unbannedAt: record.unbannedAt?.toISOString() ?? null };
}
