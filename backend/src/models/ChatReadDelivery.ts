import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema({
  _id: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  conversationId: { type: String, required: true },
  readSeq: { type: Number, default: 0 },
  revision: { type: Number, default: 0 },
  pending: { type: Boolean, default: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });
schema.index({ pending: 1, nextAttemptAt: 1 });
type Delivery = InferSchemaType<typeof schema>;
export const ChatReadDelivery = (models.ChatReadDelivery as Model<Delivery> | undefined) ?? model<Delivery>("ChatReadDelivery", schema);
