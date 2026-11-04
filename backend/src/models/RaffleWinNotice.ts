import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  campaign: { type: String, required: true, maxlength: 80 },
  round: { type: Number, required: true, min: 1 },
  userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  telegramId: { type: String, required: true, match: /^\d+$/ },
  amountCents: { type: Number, required: true, min: 1 },
  acknowledgedAt: Date,
}, { timestamps: true, versionKey: false });
schema.index({ campaign: 1, round: 1 }, { unique: true });
schema.index({ userId: 1, acknowledgedAt: 1, createdAt: 1 });
schema.index({ telegramId: 1, createdAt: -1 });
type Notice = InferSchemaType<typeof schema>;
export const RaffleWinNotice = (models.RaffleWinNotice as Model<Notice> | undefined) ?? model<Notice>("RaffleWinNotice", schema);

const replySchema = new Schema({
  telegramId: { type: String, required: true },
  messageId: { type: Number, required: true },
  userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  text: { type: String, required: true, maxlength: 4096 },
  forwardedAt: Date,
}, { timestamps: true, versionKey: false });
replySchema.index({ telegramId: 1, messageId: 1 }, { unique: true });
replySchema.index({ createdAt: -1 });
type Reply = InferSchemaType<typeof replySchema>;
export const RaffleWinnerReply = (models.RaffleWinnerReply as Model<Reply> | undefined) ?? model<Reply>("RaffleWinnerReply", replySchema);
