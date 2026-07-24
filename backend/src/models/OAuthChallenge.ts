import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const oauthChallengeSchema = new Schema(
  {
    provider: { type: String, enum: ["yandex"], required: true },
    flowId: { type: String, required: true, maxlength: 128 },
    bindingHash: { type: String, required: true },
    redirectUri: { type: String, required: true, maxlength: 2_048 },
    referralCode: { type: String, maxlength: 32 },
    codeVerifier: { type: String, required: true, select: false, maxlength: 128 },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date }
  },
  { timestamps: true, versionKey: false }
);

oauthChallengeSchema.index({ provider: 1, flowId: 1 }, { unique: true });
oauthChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OAuthChallengeDocument = InferSchemaType<typeof oauthChallengeSchema>;
export const OAuthChallenge =
  (models.OAuthChallenge as Model<OAuthChallengeDocument> | undefined) ??
  model<OAuthChallengeDocument>("OAuthChallenge", oauthChallengeSchema);
