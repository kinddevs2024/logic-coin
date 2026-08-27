import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const notificationEventSchema = new Schema(
  {
    eventKey: { type: String, required: true, trim: true, maxlength: 180 },
    type: {
      type: String,
      enum: ["daily_challenge_published", "daily_contest_settled"],
      required: true
    },
    audience: {
      type: String,
      enum: ["all_users", "contest_participants"],
      default: "all_users",
      required: true
    },
    status: {
      type: String,
      enum: ["queued", "processing", "sent", "failed"],
      default: "queued",
      required: true
    },
    targetCount: { type: Number, min: 0, default: 0, required: true },
    sentCount: { type: Number, min: 0, default: 0, required: true },
    failedCount: { type: Number, min: 0, default: 0, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    processedAt: { type: Date },
    failureReason: { type: String, maxlength: 240 }
  },
  { timestamps: true, versionKey: false }
);

notificationEventSchema.index({ eventKey: 1 }, { unique: true });
notificationEventSchema.index({ status: 1, createdAt: 1 });

export type NotificationEventDocument = InferSchemaType<typeof notificationEventSchema>;
export const NotificationEvent =
  (models.NotificationEvent as Model<NotificationEventDocument> | undefined) ??
  model<NotificationEventDocument>("NotificationEvent", notificationEventSchema);
