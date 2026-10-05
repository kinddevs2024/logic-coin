import { Schema, model } from "mongoose";
const schema = new Schema({
  ticketId: { type: String, required: true, unique: true },
  pushToken: { type: String, required: true },
  eventId: { type: Schema.Types.ObjectId, required: true },
  checkAfter: { type: Date, required: true },
  expiresAt: { type: Date, required: true }
}, { versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ checkAfter: 1 });
export const PushReceipt = model("PushReceipt", schema);
