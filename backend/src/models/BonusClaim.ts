import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const bonusClaimSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    key: { type: String, required: true },
    kind: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
    rewardUnits: { type: Number, min: 1, required: true },
    localDayKey: { type: String, required: true },
    claimedAt: { type: Date, required: true }
  },
  { timestamps: true, versionKey: false }
);

bonusClaimSchema.index({ userId: 1, key: 1 }, { unique: true });
bonusClaimSchema.index({ userId: 1, claimedAt: -1 });

export type BonusClaimDocument = InferSchemaType<typeof bonusClaimSchema>;
export const BonusClaim =
  (models.BonusClaim as Model<BonusClaimDocument> | undefined) ??
  model<BonusClaimDocument>("BonusClaim", bonusClaimSchema);
