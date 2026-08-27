import { Router } from "express";
import { z } from "zod";
import { SUPPORTED_LANGUAGES, THEMES } from "../config/constants.js";
import { ApiError } from "../lib/api-error.js";
import { isValidTimeZone } from "../lib/timezone.js";
import { validateBody } from "../middleware/validate.js";
import { User } from "../models/User.js";
import { serializeUser } from "../services/serialization.service.js";

const router = Router();

router.get("/", async (request, response) => {
  const user = await User.findById(request.auth!.userId);
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  response.json({ data: { user: serializeUser(user) } });
});

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const MAX_AVATAR_DATA_URL_CHARS = Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 64;

function validAvatarDataUrl(value: string): boolean {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match?.[1] || !match[2]) return false;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) return false;
  if (match[1] === "jpeg") {
    return bytes.length >= 4 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff &&
      bytes[bytes.length - 2] === 0xff &&
      bytes[bytes.length - 1] === 0xd9;
  }
  if (match[1] === "png") {
    return bytes.length >= 24 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) &&
      bytes.subarray(12, 16).toString("ascii") === "IHDR";
  }
  return bytes.length >= 16 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP" &&
    ["VP8 ", "VP8L", "VP8X"].includes(bytes.subarray(12, 16).toString("ascii"));
}

const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    avatarDataUrl: z
      .string()
      .max(MAX_AVATAR_DATA_URL_CHARS)
      .refine(validAvatarDataUrl, "Avatar must be a valid JPEG, PNG, or WebP image up to 10 MiB")
      .nullable()
      .optional(),
    savingsGoalCents: z.number().int().min(0).max(1_000_000_000).optional(),
    countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

router.patch(["/", "/profile"], validateBody(profileSchema), async (request, response) => {
  const input = request.body as z.infer<typeof profileSchema>;
  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.avatarDataUrl === null) unset.avatarUrl = 1;
  else if (input.avatarDataUrl !== undefined) set.avatarUrl = input.avatarDataUrl;
  if (input.savingsGoalCents !== undefined) {
    set["preferences.savingsGoalCents"] = input.savingsGoalCents;
  }
  if (input.countryCode !== undefined) set.countryCode = input.countryCode;

  const user = await User.findByIdAndUpdate(
    request.auth!.userId,
    {
      ...(Object.keys(set).length ? { $set: set } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {})
    },
    { new: true, runValidators: true }
  );
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  response.json({ data: { user: serializeUser(user) } });
});

router.get("/preferences", async (request, response) => {
  const user = await User.findById(request.auth!.userId).select("preferences");
  if (!user) {
    throw new ApiError(404, "user_not_found", "User not found");
  }
  response.json({ data: { preferences: user.preferences } });
});

const preferencesSchema = z
  .object({
    language: z.enum(SUPPORTED_LANGUAGES).optional(),
    theme: z.enum(THEMES).optional(),
    notificationsEnabled: z.boolean().optional(),
    dailyReminderEnabled: z.boolean().optional(),
    timezone: z.string().min(1).max(100).refine(isValidTimeZone, "Invalid IANA timezone").optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

router.patch("/preferences", validateBody(preferencesSchema), async (request, response) => {
  const input = request.body as z.infer<typeof preferencesSchema>;
  const set = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [`preferences.${key}`, value])
  );

  const currentUser = await User.findById(request.auth!.userId).select(
    "preferences timezoneChangedAt"
  );
  if (!currentUser) {
    throw new ApiError(404, "user_not_found", "User not found");
  }

  let user = currentUser;
  const requestedTimezone = input.timezone;
  const currentTimezone = currentUser.preferences.timezone;

  if (requestedTimezone === currentTimezone) {
    delete set["preferences.timezone"];
    if (Object.keys(set).length > 0) {
      const updatedUser = await User.findByIdAndUpdate(
        request.auth!.userId,
        { $set: set },
        { new: true, runValidators: true }
      ).select("preferences");
      if (!updatedUser) {
        throw new ApiError(404, "user_not_found", "User not found");
      }
      user = updatedUser;
    }
  } else if (requestedTimezone !== undefined) {
    const now = new Date();
    const cooldownCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
    if (
      currentUser.timezoneChangedAt &&
      currentUser.timezoneChangedAt.getTime() > cooldownCutoff.getTime()
    ) {
      throw new ApiError(
        409,
        "timezone_change_cooldown",
        "Timezone can only be changed once every 30 days"
      );
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: request.auth!.userId,
        "preferences.timezone": currentTimezone,
        $or: [
          { timezoneChangedAt: { $exists: false } },
          { timezoneChangedAt: { $lte: cooldownCutoff } }
        ]
      },
      { $set: { ...set, timezoneChangedAt: now } },
      { new: true, runValidators: true }
    ).select("preferences timezoneChangedAt");

    if (!updatedUser) {
      throw new ApiError(
        409,
        "timezone_change_cooldown",
        "Timezone was changed recently; try again later"
      );
    }
    user = updatedUser;
  } else if (Object.keys(set).length > 0) {
    const updatedUser = await User.findByIdAndUpdate(
      request.auth!.userId,
      { $set: set },
      { new: true, runValidators: true }
    ).select("preferences");
    if (!updatedUser) {
      throw new ApiError(404, "user_not_found", "User not found");
    }
    user = updatedUser;
  }

  response.json({ data: { preferences: user.preferences } });
});

export default router;
