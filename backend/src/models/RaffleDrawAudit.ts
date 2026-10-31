import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema({ eventId: { type: Schema.Types.ObjectId, required: true }, roundId: { type: Schema.Types.ObjectId, required: true }, eligibleUserIds: { type: [Schema.Types.ObjectId], required: true }, selectedUserId: { type: Schema.Types.ObjectId, required: true }, poolHash: { type: String, required: true } }, { timestamps: true, versionKey: false });
schema.index({ eventId: 1, roundId: 1 }, { unique: true });
export type RaffleDrawAuditDocument = InferSchemaType<typeof schema>;
export const RaffleDrawAudit = (models.RaffleDrawAudit as Model<RaffleDrawAuditDocument> | undefined) ?? model<RaffleDrawAuditDocument>("RaffleDrawAudit", schema);
