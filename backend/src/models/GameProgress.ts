import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const gameProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    games: { type: Schema.Types.Mixed, required: true, default: () => ({}) }
  },
  {
    timestamps: true,
    minimize: false,
    versionKey: false
  }
);

gameProgressSchema.index({ userId: 1 }, { unique: true });

export type GameProgressDocument = InferSchemaType<typeof gameProgressSchema>;
export const GameProgress =
  (models.GameProgress as Model<GameProgressDocument> | undefined) ??
  model<GameProgressDocument>("GameProgress", gameProgressSchema);
