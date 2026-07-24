import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const refreshSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },
    familyId: { type: String, maxlength: 64 },
    deviceId: { type: String, maxlength: 160 },
    userAgent: { type: String, maxlength: 500 },
    ip: { type: String, maxlength: 100 },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedByHash: { type: String },
    revokeReason: {
      type: String,
      enum: ["rotated", "logout", "logout_all", "reuse_detected"]
    },
    reuseDetectedAt: { type: Date }
  },
  { timestamps: true, versionKey: false }
);

refreshSessionSchema.index({ tokenHash: 1 }, { unique: true });
refreshSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
refreshSessionSchema.index({ userId: 1, familyId: 1, revokedAt: 1 });
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshSessionDocument = InferSchemaType<typeof refreshSessionSchema>;
export const RefreshSession =
  (models.RefreshSession as Model<RefreshSessionDocument> | undefined) ??
  model<RefreshSessionDocument>("RefreshSession", refreshSessionSchema);
