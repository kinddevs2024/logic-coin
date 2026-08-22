import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const challengeAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    gameId: { type: Schema.Types.ObjectId, ref: "Game", required: true },
    gameKey: { type: String, required: true, trim: true, lowercase: true },
    dailyChallengeSetId: { type: Schema.Types.ObjectId, ref: "DailyChallengeSet" },
    dayKey: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    mode: { type: String, enum: ["challenge", "practice"], required: true },
    attemptNumber: { type: Number, min: 1, default: 1, required: true },
    status: {
      type: String,
      enum: ["started", "completed", "abandoned"],
      default: "started",
      required: true
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    score: { type: Number, min: 0 },
    coinsAwarded: { type: Number, min: 0, max: 1_000, default: 0 },
    durationMs: { type: Number, min: 0 },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, versionKey: false }
);

challengeAttemptSchema.index({ userId: 1, createdAt: -1 });
challengeAttemptSchema.index({ dayKey: 1, gameId: 1, status: 1, score: -1 });
challengeAttemptSchema.index(
  { userId: 1, dayKey: 1, gameId: 1, mode: 1, attemptNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { mode: "challenge" },
    name: "one_daily_challenge_attempt_per_game_number"
  }
);

export type ChallengeAttemptDocument = InferSchemaType<typeof challengeAttemptSchema>;
export const ChallengeAttempt =
  (models.ChallengeAttempt as Model<ChallengeAttemptDocument> | undefined) ??
  model<ChallengeAttemptDocument>("ChallengeAttempt", challengeAttemptSchema);
