import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../lib/api-error.js";
import { isValidTimeZone } from "../lib/timezone.js";
import { validateBody } from "../middleware/validate.js";
import { Device } from "../models/Device.js";

const router = Router();
const deviceIdSchema = z.string().trim().min(1).max(160);

router.get("/", async (request, response) => {
  const devices = await Device.find({ userId: request.auth!.userId })
    .sort({ lastSeenAt: -1 })
    .lean();
  response.json({
    data: {
      devices: devices.map((device) => ({
        id: device._id.toString(),
        deviceId: device.deviceId,
        platform: device.platform,
        notificationsEnabled: device.notificationsEnabled,
        dailyReminderEnabled: device.dailyReminderEnabled,
        reminderTime: device.reminderTime,
        timezone: device.timezone,
        pushConfigured: Boolean(device.pushToken),
        lastSeenAt: device.lastSeenAt
      }))
    }
  });
});

const devicePreferencesSchema = z
  .object({
    platform: z.enum(["android", "ios", "web"]),
    pushToken: z.string().trim().min(8).max(4_096).nullable().optional(),
    notificationsEnabled: z.boolean().default(true),
    dailyReminderEnabled: z.boolean().default(true),
    reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("19:00"),
    timezone: z.string().min(1).max(100).refine(isValidTimeZone, "Invalid IANA timezone")
  })
  .strict();

router.put(
  "/:deviceId/preferences",
  validateBody(devicePreferencesSchema),
  async (request, response) => {
    const parsedDeviceId = deviceIdSchema.safeParse(request.params.deviceId);
    if (!parsedDeviceId.success) {
      throw new ApiError(400, "invalid_device_id", "Device identifier is invalid");
    }
    const input = request.body as z.infer<typeof devicePreferencesSchema>;
    const set: Record<string, unknown> = {
      platform: input.platform,
      notificationsEnabled: input.notificationsEnabled,
      dailyReminderEnabled: input.dailyReminderEnabled,
      reminderTime: input.reminderTime,
      timezone: input.timezone,
      lastSeenAt: new Date()
    };
    const unset = input.pushToken === null ? { pushToken: 1 } : {};
    if (input.pushToken) set.pushToken = input.pushToken;

    const device = await Device.findOneAndUpdate(
      { userId: request.auth!.userId, deviceId: parsedDeviceId.data },
      {
        $set: set,
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
        $setOnInsert: { userId: request.auth!.userId, deviceId: parsedDeviceId.data }
      },
      { upsert: true, new: true, runValidators: true }
    );
    response.json({
      data: {
        device: {
          id: device._id.toString(),
          deviceId: device.deviceId,
          platform: device.platform,
          notificationsEnabled: device.notificationsEnabled,
          dailyReminderEnabled: device.dailyReminderEnabled,
          reminderTime: device.reminderTime,
          timezone: device.timezone,
          pushConfigured: Boolean(device.pushToken),
          lastSeenAt: device.lastSeenAt
        }
      }
    });
  }
);

router.delete("/:deviceId", async (request, response) => {
  const parsedDeviceId = deviceIdSchema.safeParse(request.params.deviceId);
  if (!parsedDeviceId.success) {
    throw new ApiError(400, "invalid_device_id", "Device identifier is invalid");
  }
  await Device.deleteOne({ userId: request.auth!.userId, deviceId: parsedDeviceId.data });
  response.status(204).send();
});

export default router;
