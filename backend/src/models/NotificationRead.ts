import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  notificationId: { type: String, required: true, maxlength: 64 },
  readAt: { type: Date, required: true }
}, { versionKey: false });
schema.index({ userId: 1, notificationId: 1 }, { unique: true });
type ReadDocument = InferSchemaType<typeof schema>;
export const NotificationRead = (models.NotificationRead as Model<ReadDocument> | undefined) ?? model<ReadDocument>("NotificationRead", schema);
