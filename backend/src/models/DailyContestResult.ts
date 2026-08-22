import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const dailyContestResultSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    totalCoins: { type: Number, required: true, min: 0 },
    completedGamesCount: { type: Number, required: true, min: 0, max: 6 },
    rank: { type: Number, required: true, min: 1 },
    rewardType: { type: String, enum: ["cash", "case", "coins"], required: true },
    cashUnits: { type: Number, min: 0 },
    coinAmount: { type: Number, min: 0 },
    caseKind: { type: String, maxlength: 80 },
    giftKind: { type: String, enum: ["extra_time", "replay", "coin"] },
    settledAt: { type: Date, required: true }
  },
  { timestamps: true, versionKey: false }
);

dailyContestResultSchema.index({ dayKey: 1, userId: 1 }, { unique: true });
dailyContestResultSchema.index({ dayKey: 1, rank: 1 }, { unique: true });

export type DailyContestResultDocument = InferSchemaType<typeof dailyContestResultSchema>;
export const DailyContestResult =
  (models.DailyContestResult as Model<DailyContestResultDocument> | undefined) ??
  model<DailyContestResultDocument>("DailyContestResult", dailyContestResultSchema);
