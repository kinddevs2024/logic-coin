import { Router } from "express";
import { z } from "zod";
import { PIGGY_BANK_VARIANTS, SUPPORTED_LANGUAGES, THEMES } from "../config/constants.js";
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

const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    avatarUrl: z.string().url().max(2_048).nullable().optional(),
    savingsGoalCents: z.number().int().min(0).max(1_000_000_000).optional(),
    piggyBankVariant: z.enum(PIGGY_BANK_VARIANTS).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

router.patch("/", validateBody(profileSchema), async (request, response) => {
  const input = request.body as z.infer<typeof profileSchema>;
  const set: Record<string, unknown> = {};
  const unset: Record<string, 1> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.avatarUrl === null) unset.avatarUrl = 1;
  else if (input.avatarUrl !== undefined) set.avatarUrl = input.avatarUrl;
  if (input.savingsGoalCents !== undefined) {
    set["preferences.savingsGoalCents"] = input.savingsGoalCents;
  }
  if (input.piggyBankVariant !== undefined) {
    set["preferences.piggyBankVariant"] = input.piggyBankVariant;
  }

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
