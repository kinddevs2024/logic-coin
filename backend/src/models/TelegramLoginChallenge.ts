import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const telegramUserSchema = new Schema(
  {
    id: { type: String, required: true },
    firstName: { type: String, required: true, maxlength: 80 },
    lastName: { type: String, maxlength: 80 },
    username: { type: String, maxlength: 64 },
    photoUrl: { type: String, maxlength: 2_048 }
  },
  { _id: false }
);

const telegramLoginChallengeSchema = new Schema(
  {
    flowId: { type: String, required: true, maxlength: 64 },
    pollTokenHash: { type: String, required: true, select: false },
    resumeTokenHash: { type: String, select: false },
    telegramUser: { type: telegramUserSchema },
    confirmedAt: { type: Date },
    pollConsumedAt: { type: Date },
    resumeConsumedAt: { type: Date },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true, versionKey: false }
);

telegramLoginChallengeSchema.index({ flowId: 1 }, { unique: true });
telegramLoginChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type TelegramLoginChallengeDocument = InferSchemaType<
  typeof telegramLoginChallengeSchema
>;
export const TelegramLoginChallenge =
  (models.TelegramLoginChallenge as
    | Model<TelegramLoginChallengeDocument>
    | undefined) ??
  model<TelegramLoginChallengeDocument>(
    "TelegramLoginChallenge",
    telegramLoginChallengeSchema
  );
