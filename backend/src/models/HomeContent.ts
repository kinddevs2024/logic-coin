import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema({
  key: { type: String, required: true, unique: true },
  rules: { type: String, default: "", maxlength: 12000 },
  weeklyDetails: { type: String, default: "", maxlength: 12000 },
  monthlyDetails: { type: String, default: "", maxlength: 12000 },
  instagramUrl: { type: String, default: "", maxlength: 500 },
  telegramUrl: { type: String, default: "", maxlength: 500 },
}, { timestamps: true, versionKey: false });
type HomeContentDocument = InferSchemaType<typeof schema>;
export const HomeContent = (models.HomeContent as Model<HomeContentDocument> | undefined) ?? model<HomeContentDocument>("HomeContent", schema);
