import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const REWARDED_AD_PLACEMENTS = [
  "challenge-first-game",
  "challenge-first-replay",
  "challenge-third-game",
  "challenge-day-complete",
  "navigation-frequency",
  "practice-replay"
] as const;

const rewardedAdSessionSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true, maxlength: 80 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["appodeal"], default: "appodeal", required: true },
    placement: { type: String, enum: REWARDED_AD_PLACEMENTS, required: true },
    status: {
      type: String,
      enum: ["started", "completed", "claimed", "expired"],
      default: "started",
      required: true
    },
    rewardCoins: { type: Number, min: 0, max: 1_000, default: 0, required: true },
    clientReceiptId: { type: String, maxlength: 180 },
    impressionId: { type: String, maxlength: 180 },
    completedAt: { type: Date },
    claimedAt: { type: Date },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true, versionKey: false }
);

rewardedAdSessionSchema.index({ userId: 1, status: 1, createdAt: -1 });
rewardedAdSessionSchema.index(
  { clientReceiptId: 1 },
  { unique: true, partialFilterExpression: { clientReceiptId: { $type: "string" } } }
);
rewardedAdSessionSchema.index(
  { impressionId: 1 },
  { unique: true, partialFilterExpression: { impressionId: { $type: "string" } } }
);
rewardedAdSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export type RewardedAdSessionDocument = InferSchemaType<typeof rewardedAdSessionSchema>;
export const RewardedAdSession =
  (models.RewardedAdSession as Model<RewardedAdSessionDocument> | undefined) ??
  model<RewardedAdSessionDocument>("RewardedAdSession", rewardedAdSessionSchema);
