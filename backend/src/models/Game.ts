import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const localizedTextSchema = new Schema(
  {
    en: { type: String, required: true, trim: true, maxlength: 120 },
    ru: { type: String, required: true, trim: true, maxlength: 120 },
    uz: { type: String, required: true, trim: true, maxlength: 120 }
  },
  { _id: false }
);

const scoringSchema = new Schema(
  {
    higherIsBetter: { type: Boolean, default: true, required: true },
    maxCoins: { type: Number, min: 1, max: 1_000, default: 1_000, required: true }
  },
  { _id: false }
);

const gameSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    title: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, required: true },
    icon: { type: String, required: true, trim: true, maxlength: 80 },
    color: { type: String, required: true, default: "#0866FF", match: /^#[0-9a-f]{6}$/i },
    engine: { type: String, enum: ["native", "webview"], default: "webview", required: true },
    clientPath: { type: String, trim: true, maxlength: 240 },
    assetPath: { type: String, trim: true, maxlength: 240 },
    enabled: { type: Boolean, default: true, required: true },
    challengeEnabled: { type: Boolean, default: true, required: true },
    practiceEnabled: { type: Boolean, default: true, required: true },
    sortOrder: { type: Number, default: 0, required: true },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
      required: true
    },
    scoring: { type: scoringSchema, required: true, default: () => ({}) }
  },
  { timestamps: true, versionKey: false }
);

gameSchema.index({ key: 1 }, { unique: true });
gameSchema.index({ slug: 1 }, { unique: true });
gameSchema.index({ enabled: 1, practiceEnabled: 1, sortOrder: 1 });
gameSchema.index({ enabled: 1, challengeEnabled: 1, sortOrder: 1 });

export type GameDocument = InferSchemaType<typeof gameSchema>;
export const Game =
  (models.Game as Model<GameDocument> | undefined) ?? model<GameDocument>("Game", gameSchema);
