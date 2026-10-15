import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema({
  _id: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  dayKey: { type: String, required: true },
  slot: { type: Number, min: 1, max: 7, required: true },
}, { timestamps: true, versionKey: false });
schema.index({ userId: 1, dayKey: 1 });
export type CoinRewardLoginDocument = InferSchemaType<typeof schema>;
export const CoinRewardLogin = (models.CoinRewardLogin as Model<CoinRewardLoginDocument> | undefined) ?? model<CoinRewardLoginDocument>("CoinRewardLogin", schema);
