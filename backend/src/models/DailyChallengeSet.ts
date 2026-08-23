import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import {
  DEFAULT_DAILY_PRIZE_MAX_UNITS,
  DEFAULT_DAILY_PRIZE_MIN_UNITS,
  DEFAULT_DAILY_PRIZE_POOL_UNITS
} from "../config/constants.js";

const dailyChallengeSetSchema = new Schema(
  {
    dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    timezone: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "published", "settled"],
      default: "published",
      required: true
    },
    selectionMode: {
      type: String,
      enum: ["seeded", "random", "manual"],
      default: "seeded",
      required: true
    },
    selectionSeed: { type: String, required: true, maxlength: 160 },
    maxAttemptsPerGame: { type: Number, min: 1, max: 100, default: 1, required: true },
    oneSecondAttemptLimit: { type: Number, min: 1, max: 100, default: 20, required: true },
    gameIds: {
      type: [Schema.Types.ObjectId],
      ref: "Game",
      required: true,
      validate: {
        validator: (value: unknown[]) => value.length === 6,
        message: "A daily challenge must contain exactly six games"
      }
    },
    cashPrizeMinUnits: {
      type: Number,
      min: 0,
      default: DEFAULT_DAILY_PRIZE_MIN_UNITS,
      required: true
    },
    cashPrizeMaxUnits: {
      type: Number,
      min: 0,
      default: DEFAULT_DAILY_PRIZE_MAX_UNITS,
      required: true
    },
    prizePoolUnits: {
      type: Number,
      min: 0,
      default: DEFAULT_DAILY_PRIZE_POOL_UNITS,
      required: true
    },
    publishedAt: { type: Date },
    endsAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedBySubject: { type: String, trim: true, maxlength: 120 }
  },
  { timestamps: true, versionKey: false }
);

dailyChallengeSetSchema.index({ dayKey: 1 }, { unique: true });
dailyChallengeSetSchema.index({ status: 1, dayKey: -1 });
dailyChallengeSetSchema.index({ status: 1, endsAt: 1 });

export type DailyChallengeSetDocument = InferSchemaType<typeof dailyChallengeSetSchema>;
export const DailyChallengeSet =
  (models.DailyChallengeSet as Model<DailyChallengeSetDocument> | undefined) ??
  model<DailyChallengeSetDocument>("DailyChallengeSet", dailyChallengeSetSchema);
