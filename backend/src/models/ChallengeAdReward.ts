import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

// Contest points only. Never posted to the user's spendable coin wallet.
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  sessionId: { type: String, required: true, unique: true },
  dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  amount: { type: Number, required: true, min: 1 },
}, { timestamps: true, versionKey: false });
schema.index({ dayKey: 1, userId: 1 });
type Document = InferSchemaType<typeof schema>;
export const ChallengeAdReward = (models.ChallengeAdReward as Model<Document> | undefined) ?? model<Document>("ChallengeAdReward", schema);
