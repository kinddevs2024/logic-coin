import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const dailyContestSettlementSchema = new Schema(
  {
    dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: {
      type: String,
      enum: ["pending", "settling", "settled", "failed"],
      default: "pending",
      required: true
    },
    participantCount: { type: Number, default: 0, min: 0, required: true },
    cashWinnersCount: { type: Number, default: 0, min: 0, required: true },
    caseWinnersCount: { type: Number, default: 0, min: 0, required: true },
    randomWinnersCount: { type: Number, default: 0, min: 0, required: true },
    coinWinnersCount: { type: Number, default: 0, min: 0, required: true },
    prizePoolUnits: { type: Number, default: 0, min: 0, required: true },
    cashDistributedUnits: { type: Number, default: 0, min: 0, required: true },
    settledAt: { type: Date },
    failureReason: { type: String, maxlength: 240 }
  },
  { timestamps: true, versionKey: false }
);

dailyContestSettlementSchema.index({ dayKey: 1 }, { unique: true });

export type DailyContestSettlementDocument = InferSchemaType<typeof dailyContestSettlementSchema>;
export const DailyContestSettlement =
  (models.DailyContestSettlement as Model<DailyContestSettlementDocument> | undefined) ??
  model<DailyContestSettlementDocument>("DailyContestSettlement", dailyContestSettlementSchema);
