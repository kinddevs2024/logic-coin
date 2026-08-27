import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const deviceSecuritySchema = new Schema(
  {
    deviceId: { type: String, required: true, unique: true, maxlength: 160 },
    accountIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    registeredAccountIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    bannedAt: { type: Date },
    banReason: { type: String, enum: ["registration_limit", "manual"] },
    unbannedAt: { type: Date },
    unbannedBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastSeenAt: { type: Date, required: true }
  },
  { timestamps: true, versionKey: false }
);

deviceSecuritySchema.index({ bannedAt: -1, updatedAt: -1 });

export type DeviceSecurityDocument = InferSchemaType<typeof deviceSecuritySchema>;
export const DeviceSecurity =
  (models.DeviceSecurity as Model<DeviceSecurityDocument> | undefined) ??
  model<DeviceSecurityDocument>("DeviceSecurity", deviceSecuritySchema);
