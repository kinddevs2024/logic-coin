import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
const schema = new Schema({
  telegramId: { type: String, required: true, unique: true },
  step: { type: String, default: "" },
  data: { type: Schema.Types.Mixed, default: {} },
  lastMessageId: Number,
  timerMessageId: Number,
  timerUntil: Date,
  lastTimerRefreshAt: Date,
  expiresAt: { type: Date, required: true }
}, { versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ timerUntil: 1, lastTimerRefreshAt: 1 });
type Conversation = InferSchemaType<typeof schema>;
export const TelegramConversation = (models.TelegramConversation as Model<Conversation> | undefined) ?? model<Conversation>("TelegramConversation", schema);
