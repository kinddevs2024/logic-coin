import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const activityDaySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dayKey: { type: String, required: true },
    actionCount: { type: Number, min: 1, default: 1 },
    rewardUnits: { type: Number, min: 0, default: 0 },
    firstActivityAt: { type: Date, required: true },
    lastActivityAt: { type: Date, required: true }
  },
  { timestamps: true, versionKey: false }
);

activityDaySchema.index({ userId: 1, dayKey: 1 }, { unique: true });
activityDaySchema.index({ userId: 1, dayKey: -1 });

export type ActivityDayDocument = InferSchemaType<typeof activityDaySchema>;
export const ActivityDay =
  (models.ActivityDay as Model<ActivityDayDocument> | undefined) ??
  model<ActivityDayDocument>("ActivityDay", activityDaySchema);
