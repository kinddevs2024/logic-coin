import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const otpChallengeSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, enum: ["verify_email"], required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, min: 0, default: 0 },
    sentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date }
  },
  { timestamps: true, versionKey: false }
);

otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpChallengeSchema.index({ email: 1, purpose: 1, createdAt: -1 });

export type OtpChallengeDocument = InferSchemaType<typeof otpChallengeSchema>;
export const OtpChallenge =
  (models.OtpChallenge as Model<OtpChallengeDocument> | undefined) ??
  model<OtpChallengeDocument>("OtpChallenge", otpChallengeSchema);
