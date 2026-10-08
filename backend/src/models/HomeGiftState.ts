import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  telegramRewardedAt: Date,
  availableAt: { type: Date, required: true },
  cycleId: String,
  cycleDayKey: String,
  cycleExpiresAt: Date,
  lastClaimedCycle: String,
}, { timestamps: true, versionKey: false });
type Document = InferSchemaType<typeof schema>;
export const HomeGiftState = (models.HomeGiftState as Model<Document> | undefined) ?? model<Document>("HomeGiftState", schema);
