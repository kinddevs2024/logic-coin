import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const deviceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deviceId: { type: String, required: true, maxlength: 160 },
    platform: { type: String, enum: ["android", "ios", "web"], required: true },
    pushToken: { type: String, maxlength: 4_096 },
    notificationsEnabled: { type: Boolean, default: true },
    dailyReminderEnabled: { type: Boolean, default: true },
    reminderTime: { type: String, default: "19:00" },
    timezone: { type: String, default: "UTC" },
    lastSeenAt: { type: Date, required: true }
  },
  { timestamps: true, versionKey: false }
);

deviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
deviceSchema.index({ notificationsEnabled: 1, dailyReminderEnabled: 1, reminderTime: 1 });

export type DeviceDocument = InferSchemaType<typeof deviceSchema>;
export const Device =
  (models.Device as Model<DeviceDocument> | undefined) ?? model<DeviceDocument>("Device", deviceSchema);
