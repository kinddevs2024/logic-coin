import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const ledgerEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["task_reward", "daily_bonus", "weekly_bonus", "monthly_bonus", "referral_bonus", "game_reward", "withdrawal"],
      required: true
    },
    amountUnits: { type: Number, required: true },
    balanceAfterUnits: { type: Number, required: true, min: 0 },
    sourceId: { type: String, required: true },
    description: { type: String, required: true, maxlength: 240 },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, versionKey: false }
);

ledgerEntrySchema.index({ userId: 1, createdAt: -1, _id: -1 });
ledgerEntrySchema.index({ userId: 1, type: 1, sourceId: 1 }, { unique: true });

export type LedgerEntryDocument = InferSchemaType<typeof ledgerEntrySchema>;
export const LedgerEntry =
  (models.LedgerEntry as Model<LedgerEntryDocument> | undefined) ??
  model<LedgerEntryDocument>("LedgerEntry", ledgerEntrySchema);
