import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// Separate from email OTPs: only a successful provider sign-in can issue this proof.
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  tokenHash: { type: String, required: true, select: false },
  deviceId: { type: String, maxlength: 160 },
  expiresAt: { type: Date, required: true }
}, { timestamps: true, versionKey: false });
schema.index({ tokenHash: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

type PasswordSetupChallengeDocument = InferSchemaType<typeof schema>;
export const PasswordSetupChallenge =
  (models.PasswordSetupChallenge as Model<PasswordSetupChallengeDocument> | undefined) ??
  model<PasswordSetupChallengeDocument>("PasswordSetupChallenge", schema);
