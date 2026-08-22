import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const budgetEntrySchema = new Schema(
  {
    dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    type: {
      type: String,
      enum: ["ad_revenue", "other_revenue", "operating_expense"],
      required: true
    },
    amountUnits: { type: Number, required: true, min: 1 },
    sourceId: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, trim: true, maxlength: 240 },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, versionKey: false }
);

budgetEntrySchema.index({ type: 1, sourceId: 1 }, { unique: true });
budgetEntrySchema.index({ dayKey: 1, type: 1, createdAt: -1 });

export type BudgetEntryDocument = InferSchemaType<typeof budgetEntrySchema>;
export const BudgetEntry =
  (models.BudgetEntry as Model<BudgetEntryDocument> | undefined) ??
  model<BudgetEntryDocument>("BudgetEntry", budgetEntrySchema);
