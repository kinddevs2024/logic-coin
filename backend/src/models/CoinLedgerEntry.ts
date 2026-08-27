import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const COIN_LEDGER_TYPES = [
  "challenge_coin_reward",
  "practice_coin_reward",
  "daily_consolation",
  "referral_coin_bonus",
  "case_coin_reward",
  "rewarded_ad_reward"
] as const;

const coinLedgerEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: COIN_LEDGER_TYPES, required: true },
    amount: { type: Number, required: true, min: 1 },
    balanceAfter: { type: Number, required: true, min: 0 },
    sourceId: { type: String, required: true, maxlength: 180 },
    description: { type: String, required: true, maxlength: 240 },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, versionKey: false }
);

coinLedgerEntrySchema.index({ userId: 1, createdAt: -1, _id: -1 });
coinLedgerEntrySchema.index({ userId: 1, type: 1, sourceId: 1 }, { unique: true });
coinLedgerEntrySchema.index({ "metadata.dayKey": 1, type: 1, createdAt: -1 });

export type CoinLedgerEntryDocument = InferSchemaType<typeof coinLedgerEntrySchema>;
export const CoinLedgerEntry =
  (models.CoinLedgerEntry as Model<CoinLedgerEntryDocument> | undefined) ??
  model<CoinLedgerEntryDocument>("CoinLedgerEntry", coinLedgerEntrySchema);
