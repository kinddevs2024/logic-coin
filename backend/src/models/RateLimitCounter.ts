import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const rateLimitCounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    namespace: { type: String, required: true, maxlength: 80 },
    clientHash: { type: String, required: true, maxlength: 64 },
    totalHits: { type: Number, required: true, min: 0, default: 0 },
    resetAt: { type: Date, required: true }
  },
  { versionKey: false }
);

rateLimitCounterSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });
rateLimitCounterSchema.index({ namespace: 1, clientHash: 1 });

export type RateLimitCounterDocument = InferSchemaType<typeof rateLimitCounterSchema>;
export const RateLimitCounter =
  (models.RateLimitCounter as Model<RateLimitCounterDocument> | undefined) ??
  model<RateLimitCounterDocument>("RateLimitCounter", rateLimitCounterSchema);
