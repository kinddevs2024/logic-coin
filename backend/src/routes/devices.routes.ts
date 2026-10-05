import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../lib/api-error.js";
import { isValidTimeZone } from "../lib/timezone.js";
import { validateBody } from "../middleware/validate.js";
import { Device } from "../models/Device.js";
import { env } from "../config/env.js";
import { isPushEndpoint, webPushConfigured } from "../services/web-push.service.js";

const router = Router();
const deviceIdSchema = z.string().trim().min(1).max(160);
const webPushSchema = z.object({
  endpoint: z.string().max(2048).refine(isPushEndpoint, "Unsupported push endpoint"),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}(==)?$/)
  }).strict()
}).strict();

router.get("/push-config", (_request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.json({ data: { publicKey: webPushConfigured() ? env.WEB_PUSH_PUBLIC_KEY : null } });
});

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
        pushConfigured: Boolean(device.pushToken || device.webPush?.endpoint),
        lastSeenAt: device.lastSeenAt
      }))
    }
  });
});

const devicePreferencesSchema = z
  .object({
    platform: z.enum(["android", "ios", "web"]),
    pushToken: z.string().trim().min(8).max(4_096).nullable().optional(),
    webPush: webPushSchema.nullable().optional(),
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
    const unset: Record<string, number> = {};
    if (input.pushToken === null) unset.pushToken = 1;
    if (input.webPush === null) unset.webPush = 1;
    if (input.pushToken) set.pushToken = input.pushToken;
    if (input.webPush) set.webPush = input.webPush;

    // An installation/subscription belongs to the most recently signed-in user.
    // Do not send the previous account's private notifications to a shared device.
    const ownership = [
      ...(input.pushToken ? [{ pushToken: input.pushToken }] : []),
      ...(input.webPush ? [{ "webPush.endpoint": input.webPush.endpoint }] : [])
    ];
    if (ownership.length) await Device.updateMany(
      { userId: { $ne: request.auth!.userId }, $or: ownership },
      { $unset: { pushToken: 1, webPush: 1 }, $set: { notificationsEnabled: false } }
    );

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
          pushConfigured: Boolean(device.pushToken || device.webPush?.endpoint),
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
