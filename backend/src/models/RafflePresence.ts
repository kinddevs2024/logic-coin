import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema({ _id: { type: String, required: true }, userId: { type: Schema.Types.ObjectId, required: true, index: true }, lastSeenAt: { type: Date, required: true }, eligibleDays: { type: Number, required: true, default: 0 }, dayKey: { type: String, required: true }, checkedAt: { type: Date, required: true } }, { versionKey: false });
schema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 120 });
export type RafflePresenceDocument = InferSchemaType<typeof schema>;
export const RafflePresence = (models.RafflePresence as Model<RafflePresenceDocument> | undefined) ?? model<RafflePresenceDocument>("RafflePresence", schema);
