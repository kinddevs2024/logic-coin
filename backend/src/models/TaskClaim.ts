import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const taskClaimSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    taskKey: { type: String, required: true },
    idempotencyKey: { type: String, required: true, maxlength: 160 },
    provider: { type: String, enum: ["demo"], required: true },
    rewardUnits: { type: Number, required: true, min: 1 },
    localDayKey: { type: String, required: true },
    status: { type: String, enum: ["awarded"], default: "awarded" },
    claimedAt: { type: Date, required: true }
  },
  { timestamps: true, versionKey: false }
);

taskClaimSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
taskClaimSchema.index({ userId: 1, taskId: 1, localDayKey: 1, claimedAt: -1 });
taskClaimSchema.index({ userId: 1, claimedAt: -1 });

export type TaskClaimDocument = InferSchemaType<typeof taskClaimSchema>;
export const TaskClaim =
  (models.TaskClaim as Model<TaskClaimDocument> | undefined) ??
  model<TaskClaimDocument>("TaskClaim", taskClaimSchema);
