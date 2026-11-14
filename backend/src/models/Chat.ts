import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

const conversationSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["direct", "support", "group", "channel"],
      required: true,
    },
    title: { type: String, maxlength: 100, default: "" },
    username: { type: String, lowercase: true, maxlength: 24 },
    description: { type: String, maxlength: 1000, default: "" },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    avatarAttachmentId: { type: Schema.Types.ObjectId, ref: "ChatAttachment" },
    systemKey: { type: String, enum: ["news", "community"] },
    directKey: String,
    inviteCode: String,
    visibility: { type: String, enum: ["public", "invite"], default: "invite" },
    lastSeq: { type: Number, default: 0 },
    lastMessageSeq: { type: Number, default: 0 },
    lastMessageAt: Date,
  },
  { timestamps: true, versionKey: false },
);
conversationSchema.index({ systemKey: 1 }, { unique: true, sparse: true });
conversationSchema.index({ username: 1 }, { unique: true, sparse: true });
conversationSchema.index({ directKey: 1 }, { unique: true, sparse: true });
conversationSchema.index({ inviteCode: 1 }, { unique: true, sparse: true });
conversationSchema.index({ visibility: 1, title: 1 });
type Conversation = InferSchemaType<typeof conversationSchema>;
export const ChatConversation =
  (models.ChatConversation as Model<Conversation> | undefined) ??
  model<Conversation>("ChatConversation", conversationSchema);

const memberSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      default: "member",
    },
    canEditInfo: { type: Boolean, default: false },
    chatTheme: { type: String, enum: ["system", "green", "blue", "pink", "graphite", "custom"], default: "system" },
    wallpaperAttachmentId: { type: Schema.Types.ObjectId, ref: "ChatAttachment" },
    themeExplicit: {type: Boolean, default: false},
    themeAccent: String,
    themeDark: Boolean,
    lastReadSeq: { type: Number, default: 0 },
    muted: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    leftAt: Date,
  },
  { timestamps: true, versionKey: false },
);
memberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
memberSchema.index({ userId: 1, leftAt: 1, updatedAt: -1 });
type Member = InferSchemaType<typeof memberSchema>;
export const ChatMember =
  (models.ChatMember as Model<Member> | undefined) ??
  model<Member>("ChatMember", memberSchema);

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: function(this: { system?: unknown }) { return !this.system; } },
    system: { type: new Schema({
      kind: { type: String, enum: ["withdrawal_approved", "raffle_winner"], required: true },
      recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      recipientName: { type: String, required: true, maxlength: 100 },
      amountCents: { type: Number, required: function(this: { kind?: string }) { return this.kind === "withdrawal_approved"; }, min: 1, validate: Number.isSafeInteger },
      raffleTitle: { type: String, maxlength: 160, required: function(this: { kind?: string }) { return this.kind === "raffle_winner"; } },
      prizeText: { type: String, maxlength: 160, required: function(this: { kind?: string; amountCents?: number }) { return this.kind === "raffle_winner" && this.amountCents === undefined; } },
    }, { _id: false }), default: undefined },
    seq: { type: Number, required: true },
    clientId: { type: String, required: true, maxlength: 100 },
    text: { type: String, default: "", maxlength: 4000 },
    attachmentIds: [{ type: Schema.Types.ObjectId, ref: "ChatAttachment" }],
    replyTo: { type: Schema.Types.ObjectId, ref: "ChatMessage" },
    forwardedFrom: { type: String, maxlength: 80 },
    reactions: [
      {
        _id: false,
        userId: { type: Schema.Types.ObjectId, required: true },
        emoji: { type: String, required: true, maxlength: 16 },
      },
    ],
    editedAt: Date,
    deletedAt: Date,
    hiddenFor: [{ type: Schema.Types.ObjectId }],
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);
messageSchema.index({ conversationId: 1, seq: -1 }, { unique: true });
messageSchema.index(
  { conversationId: 1, senderId: 1, clientId: 1 },
  { unique: true },
);
messageSchema.index({ conversationId: 1, pinned: 1, seq: -1 });
type Message = InferSchemaType<typeof messageSchema>;
export const ChatMessage =
  (models.ChatMessage as Model<Message> | undefined) ??
  model<Message>("ChatMessage", messageSchema);

const attachmentSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, maxlength: 180 },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    kind: { type: String, enum: ["photo", "file", "voice"], required: true },
    storageKey: { type: String, required: true },
  },
  { timestamps: true, versionKey: false },
);
attachmentSchema.index({ ownerId: 1, createdAt: -1 });
type Attachment = InferSchemaType<typeof attachmentSchema>;
export const ChatAttachment =
  (models.ChatAttachment as Model<Attachment> | undefined) ??
  model<Attachment>("ChatAttachment", attachmentSchema);

const blockSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    blockedId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true, versionKey: false },
);
blockSchema.index({ userId: 1, blockedId: 1 }, { unique: true });
type Block = InferSchemaType<typeof blockSchema>;
export const ChatBlock =
  (models.ChatBlock as Model<Block> | undefined) ??
  model<Block>("ChatBlock", blockSchema);
const reportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    messageId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true, maxlength: 500 },
    resolvedAt: Date,
  },
  { timestamps: true, versionKey: false },
);
reportSchema.index({ createdAt: -1 });
type Report = InferSchemaType<typeof reportSchema>;
export const ChatReport =
  (models.ChatReport as Model<Report> | undefined) ??
  model<Report>("ChatReport", reportSchema);

const voiceReceiptSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true },
  messageId: { type: Schema.Types.ObjectId, required: true },
  listenedAt: { type: Date, default: Date.now },
}, { versionKey: false });
voiceReceiptSchema.index({ userId: 1, messageId: 1 }, { unique: true });
type VoiceReceipt = InferSchemaType<typeof voiceReceiptSchema>;
export const ChatVoiceReceipt = (models.ChatVoiceReceipt as Model<VoiceReceipt> | undefined) ?? model<VoiceReceipt>("ChatVoiceReceipt", voiceReceiptSchema);

const friendshipSchema = new Schema({
  pairKey: { type: String, required: true, unique: true },
  requesterId: { type: Schema.Types.ObjectId, required: true },
  recipientId: { type: Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ["pending", "accepted"], required: true, default: "pending" },
}, { timestamps: true, versionKey: false });
friendshipSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
friendshipSchema.index({ requesterId: 1, status: 1 });
type Friendship = InferSchemaType<typeof friendshipSchema>;
export const ChatFriendship = (models.ChatFriendship as Model<Friendship> | undefined) ?? model<Friendship>("ChatFriendship", friendshipSchema);
