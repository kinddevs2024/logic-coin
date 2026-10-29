import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

// Image bytes are read only by image endpoints, never by account/ranking queries.
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true },
  revision: { type: String, required: true, match: /^[a-f0-9]{24}$/ },
  contentType: { type: String, required: true },
  original: { type: Buffer, required: true },
  thumbnail: { type: Buffer, required: true },
}, { timestamps: true, versionKey: false });
schema.index({ userId: 1, revision: 1 }, { unique: true });
type AvatarDocument = InferSchemaType<typeof schema>;
export const UserAvatar = (models.UserAvatar as Model<AvatarDocument> | undefined) ?? model<AvatarDocument>("UserAvatar", schema);
