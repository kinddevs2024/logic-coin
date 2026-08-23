import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const withdrawalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    idempotencyKey: { type: String, required: true, maxlength: 160 },
    amountCents: { type: Number, required: true, min: 1 },
    amountUnits: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ["sandbox", "bank_card"], default: "bank_card" },
    accountLabel: { type: String, maxlength: 120 },
    cardBrand: { type: String, enum: ["visa", "mastercard", "other"] },
    cardLast4: { type: String, match: /^\d{4}$/ },
    cardHolder: { type: String, trim: true, maxlength: 80 },
    cardExpiration: { type: String, match: /^(0[1-9]|1[0-2])\/\d{2}$/ },
    agreementVersion: { type: String, maxlength: 40 },
    status: {
      type: String,
      enum: ["sandbox_pending", "sandbox_completed", "pending_review", "approved", "paid", "rejected"],
      default: "pending_review"
    },
    requestedAt: { type: Date, required: true },
    processedAt: { type: Date }
  },
  { timestamps: true, versionKey: false }
);

withdrawalSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
withdrawalSchema.index({ userId: 1, requestedAt: -1 });
withdrawalSchema.index({ status: 1, requestedAt: 1 });

export type WithdrawalDocument = InferSchemaType<typeof withdrawalSchema>;
export const Withdrawal =
  (models.Withdrawal as Model<WithdrawalDocument> | undefined) ??
  model<WithdrawalDocument>("Withdrawal", withdrawalSchema);
