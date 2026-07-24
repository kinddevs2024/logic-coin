import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const localizedTextSchema = new Schema(
  {
    en: { type: String, required: true },
    ru: { type: String, required: true },
    uz: { type: String, required: true }
  },
  { _id: false }
);

const taskSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    provider: { type: String, enum: ["demo"], default: "demo" },
    type: {
      type: String,
      enum: ["ad", "daily", "social", "referral", "bonus"],
      required: true
    },
    icon: { type: String, required: true },
    title: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, required: true },
    rewardUnits: { type: Number, required: true, min: 1 },
    cooldownSeconds: { type: Number, required: true, min: 0, default: 0 },
    dailyLimit: { type: Number, required: true, min: 1, default: 1 },
    enabled: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true, versionKey: false }
);

taskSchema.index({ key: 1 }, { unique: true });
taskSchema.index({ enabled: 1, sortOrder: 1 });

export type TaskDocument = InferSchemaType<typeof taskSchema>;
export const Task =
  (models.Task as Model<TaskDocument> | undefined) ?? model<TaskDocument>("Task", taskSchema);
