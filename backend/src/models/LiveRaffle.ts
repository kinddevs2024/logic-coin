import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
const participant = new Schema({ userId: { type: Schema.Types.ObjectId, required: true }, name: { type: String, required: true }, avatarUrl: { type: String } }, { _id: false });
const round = new Schema({
  label: { type: String, required: true }, kind: { type: String, enum: ["cash", "physical"], required: true },
  cashUnits: { type: Number, min: 0, required: true, default: 0 }, durationSeconds: { type: Number, min: 5, max: 180, required: true },
  status: { type: String, enum: ["pending", "spinning", "finished"], default: "pending", required: true },
  startedAt: Date, finishesAt: Date, settledAt: Date, winnerName: String, winnerAvatarUrl: String, winnerId: Schema.Types.ObjectId,
  participants: { type: [participant], default: [] },
});
const schema = new Schema({
  title: { type: String, required: true }, startsAt: { type: Date, required: true },
  lockMinutes: { type: Number, min: 1, max: 30, required: true, default: 3 }, youtubeId: { type: String, required: true },
  status: { type: String, enum: ["draft", "scheduled", "live", "ended", "cancelled"], required: true, default: "draft" },
  activeSlot: { type: String }, allowRepeatWinners: { type: Boolean, default: false, required: true },
  rounds: { type: [round], required: true }, createdBy: { type: Schema.Types.ObjectId, required: true },
  publishedAt: Date, endedAt: Date, revision: { type: Number, default: 0, required: true },
}, { timestamps: true, versionKey: false });
schema.index({ activeSlot: 1 }, { unique: true, sparse: true });
schema.index({ status: 1, startsAt: 1 });
export type LiveRaffleDocument = InferSchemaType<typeof schema>;
export const LiveRaffle = (models.LiveRaffle as Model<LiveRaffleDocument> | undefined) ?? model<LiveRaffleDocument>("LiveRaffle", schema);
