import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const giftItemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: {
      type: String,
      enum: ["time_extension", "extra_time", "replay", "coin"],
      required: true
    },
    amountSeconds: { type: Number, min: 1, max: 3_600 },
    replayCount: { type: Number, min: 1, max: 10 },
    coinAmount: { type: Number, min: 1, max: 10_000 },
    activationMode: {
      type: String,
      enum: ["manual", "next_challenge"],
      default: "manual",
      required: true
    },
    sourceDayKey: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ["available", "used"], default: "available", required: true },
    sourceId: { type: String, required: true, maxlength: 180 },
    description: { type: String, required: true, maxlength: 240 },
    usedAt: { type: Date },
    usedOnGameKey: { type: String, trim: true, lowercase: true, maxlength: 80 }
  },
  { timestamps: true, versionKey: false }
);

giftItemSchema.index({ userId: 1, status: 1, createdAt: -1 });
giftItemSchema.index({ userId: 1, activationMode: 1, status: 1, sourceDayKey: 1 });
giftItemSchema.index({ userId: 1, sourceId: 1 }, { unique: true });

export type GiftItemDocument = InferSchemaType<typeof giftItemSchema>;
export const GiftItem =
  (models.GiftItem as Model<GiftItemDocument> | undefined) ??
  model<GiftItemDocument>("GiftItem", giftItemSchema);
