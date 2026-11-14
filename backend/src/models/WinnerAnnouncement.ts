import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema({
  operationId: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  recipientName: { type: String, required: true },
  raffleTitle: { type: String, required: true, maxlength: 160 },
  prizeType: { type: String, enum: ["cash", "item"], required: true },
  amountCents: { type: Number, min: 1, validate: Number.isSafeInteger },
  prizeText: { type: String, maxlength: 160 },
  fingerprint: { type: String, required: true },
  messages: [{ _id: false, conversationId: { type: Schema.Types.ObjectId, required: true }, messageId: { type: Schema.Types.ObjectId, required: true }, systemKey: { type: String, enum: ["news", "community"], required: true } }],
}, { timestamps: true, versionKey: false });
schema.index({ createdBy: 1, operationId: 1 }, { unique: true });
schema.index({ createdAt: -1 });
type Row = InferSchemaType<typeof schema>;
export const WinnerAnnouncement = (models.WinnerAnnouncement as Model<Row> | undefined) ?? model<Row>("WinnerAnnouncement", schema);
