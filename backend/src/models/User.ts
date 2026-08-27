import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { SUPPORTED_LANGUAGES, THEMES, USER_ROLES } from "../config/constants.js";

const providerSchema = new Schema(
  {
    googleSub: { type: String },
    yandexSub: { type: String },
    telegramSub: { type: String }
  },
  { _id: false }
);

const preferencesSchema = new Schema(
  {
    language: { type: String, enum: SUPPORTED_LANGUAGES, default: "ru", required: true },
    theme: { type: String, enum: THEMES, default: "light", required: true },
    savingsGoalCents: { type: Number, min: 0, default: 1_000, required: true },
    notificationsEnabled: { type: Boolean, default: true, required: true },
    dailyReminderEnabled: { type: Boolean, default: true, required: true },
    timezone: { type: String, default: "UTC", required: true }
  },
  { _id: false }
);

const walletSchema = new Schema(
  {
    availableUnits: { type: Number, min: 0, default: 0, required: true },
    lockedUnits: { type: Number, min: 0, default: 0, required: true },
    lifetimeEarnedUnits: { type: Number, min: 0, default: 0, required: true },
    referralEarnedUnits: { type: Number, min: 0, default: 0, required: true }
  },
  { _id: false }
);

const coinsSchema = new Schema(
  {
    balance: { type: Number, min: 0, default: 0, required: true },
    lifetimeEarned: { type: Number, min: 0, default: 0, required: true },
    referralEarned: { type: Number, min: 0, default: 0, required: true }
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    registrationTokenHash: { type: String, select: false },
    registrationTokenExpiresAt: { type: Date, select: false },
    emailVerifiedAt: { type: Date },
    role: { type: String, enum: USER_ROLES, default: "user", required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    avatarUrl: { type: String, trim: true, maxlength: 14_000_000 },
    countryCode: { type: String, trim: true, uppercase: true, match: /^[A-Z]{2}$/ },
    providers: { type: providerSchema, required: true, default: () => ({}) },
    referralCode: { type: String, required: true, uppercase: true },
    referredBy: { type: Schema.Types.ObjectId, ref: "User" },
    referralRewardProcessedAt: { type: Date },
    preferences: { type: preferencesSchema, required: true, default: () => ({}) },
    wallet: { type: walletSchema, required: true, default: () => ({}) },
    coins: { type: coinsSchema, required: true, default: () => ({}) },
    lastLoginAt: { type: Date },
    timezoneChangedAt: { type: Date }
  },
  {
    timestamps: true,
    minimize: false,
    versionKey: false
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ referralCode: 1 }, { unique: true });
userSchema.index({ "providers.googleSub": 1 }, { unique: true, sparse: true });
userSchema.index({ "providers.yandexSub": 1 }, { unique: true, sparse: true });
userSchema.index({ "providers.telegramSub": 1 }, { unique: true, sparse: true });
userSchema.index({ referredBy: 1, createdAt: -1 });

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User =
  (models.User as Model<UserDocument> | undefined) ?? model<UserDocument>("User", userSchema);
