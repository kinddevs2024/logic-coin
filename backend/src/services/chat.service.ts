import { ChatComment } from "../models/ChatComment.js";
import { chatVideoMime } from "../lib/chat-video.js";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile, readFile, open } from "node:fs/promises";
import path from "node:path";
import { Types, type Model } from "mongoose";
import sharp from "sharp";
import { env } from "../config/env.js";
import { ApiError } from "../lib/api-error.js";
import { listAvatarUrl } from "../lib/list-avatar.js";
import { canPostChat, normalizeUsername } from "../lib/chat-policy.js";
import { User } from "../models/User.js";
import {
  ChatConversation,
  ChatMember,
  ChatMessage,
  ChatAttachment,
  ChatBlock,
  ChatReport,
  ChatVoiceReceipt,
  ChatFriendship,
} from "../models/Chat.js";
import { NotificationRead } from "../models/NotificationRead.js";
import { NotificationEvent } from "../models/NotificationEvent.js";
import { notifyChatChange } from "./live-updates.service.js";
import { isAccessSessionActive } from "./token.service.js";

const oid = (value: string | Types.ObjectId) => new Types.ObjectId(value);
const fail = (status: number, code: string, message: string): never => {
  throw new ApiError(status, code, message);
};
const root = path.resolve(
  process.env.CHAT_MEDIA_DIR ||
    (env.NODE_ENV === "production"
      ? "/srv/apps/logic-coin/shared/chat-media"
      : ".chat-media"),
);
const defaultsReady = new Map<string, number>();
const userFields = "_id name username avatarUrl referralCode role";
export function chatProfile(user: {
  _id: unknown;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  referralCode?: string;
  role?: string;
}) {
  return {
    platformRole: user.role ?? "user",
    id: String(user._id),
    name: user.name,
    username: user.username ?? null,
    avatarUrl: listAvatarUrl(String(user._id), user.avatarUrl),
    referralCode: user.referralCode,
  };
}
async function siteAdmin(userId: Types.ObjectId) {
  return Boolean(
    await User.exists({
      _id: userId,
      role: "admin",
    }),
  );
}
async function ensureMember(
  conversationId: Types.ObjectId,
  userId: Types.ObjectId,
  role = "member",
  muted = false,
) {
  return ChatMember.findOneAndUpdate(
    { conversationId, userId },
    { $setOnInsert: { conversationId, userId, role, muted } },
    { new: true, upsert: true },
  );
}
export async function ensureChatDefaults(userId: Types.ObjectId) {
  if ((defaultsReady.get(String(userId)) ?? 0) > Date.now()) return [];
  await syncReferralFriends(userId);
  const result = [];
  for (const [systemKey, kind, title] of [
    ["news", "channel", "Logic Coin"],
    ["community", "group", "Logic Coin Community"],
  ] as const) {
    const c = await ChatConversation.findOneAndUpdate(
      { systemKey },
      {
        $setOnInsert: {
          systemKey,
          kind,
          title,
          visibility: "public",
          inviteCode: randomBytes(18).toString("base64url"),
        },
      },
      { upsert: true, new: true },
    );
    await ensureMember(c._id, userId, "member", true);
    result.push(c);
  }
  const adminFilter = {role:"admin", _id:{$ne:userId}};
  const admin = await User.findOne({...adminFilter, email:{$not:/@telegram\.logiccoin\.local$/}}).sort({createdAt:1}).select("_id").lean()
    ?? await User.findOne(adminFilter).sort({createdAt:1}).select("_id").lean();
  if (admin && String(admin._id) !== String(userId)) {
    const directKey = `support:${userId}`;
    const c = await ChatConversation.findOneAndUpdate(
      { directKey },
      {
        $setOnInsert: {
          directKey,
          kind: "support",
          title: "Logic Coin Support",
          ownerId: admin._id,
        },
      },
      { new: true, upsert: true },
    );
    await Promise.all([
      ensureMember(c._id, userId),
      ensureMember(c._id, admin._id, "owner"),
    ]);
    result.push(c);
  }
  if (defaultsReady.size > 10000) defaultsReady.clear();
  defaultsReady.set(String(userId), Date.now() + 15 * 60_000);
  return result;
}
export async function chatAccess(
  userId: Types.ObjectId,
  id: string,
  writing = false,
) {
  const c = await ChatConversation.findById(id).lean();
  if (!c) return fail(404, "chat_not_found", "Chat not found");
  let member = await ChatMember.findOne({
    conversationId: c._id,
    userId,
    leftAt: { $exists: false },
  }).lean();
  if (!member && c.systemKey)
    member = (await ensureMember(c._id, userId, "member", true))!.toObject();
  if (!member)
    return fail(
      403,
      "chat_access_denied",
      "Join the chat to read or send messages",
    );
  const admin = await siteAdmin(userId);
  if (
    writing &&
    !canPostChat({
      kind: c.kind,
      systemKey: c.systemKey,
      siteAdmin: admin,
      memberRole: member.role,
    })
  )
    return fail(403, "chat_read_only", "Only channel administrators can post");
  if (writing && (c.kind === "direct" || c.kind === "support")) {
    const others = await ChatMember.distinct("userId", {
      conversationId: c._id,
      userId: { $ne: userId },
    });
    if (c.kind === "direct") for (const other of others) await requireFriend(userId, String(other));
    if (
      await ChatBlock.exists({
        $or: [
          { userId, blockedId: { $in: others } },
          { userId: { $in: others }, blockedId: userId },
        ],
      })
    )
      return fail(
        403,
        "chat_blocked",
        "Messages are unavailable for this conversation",
      );
  }
  return { c, member, admin };
}
async function changed(c: { _id: Types.ObjectId; systemKey?: string | null }) {
  const ids = c.systemKey
    ? null
    : (
        await ChatMember.distinct("userId", {
          conversationId: c._id,
          leftAt: { $exists: false },
        })
      ).map(String);
  notifyChatChange(ids, String(c._id));
}
export async function listChats(userId: Types.ObjectId, sessionId: string) {
  await ensureChatDefaults(userId);
  const memberships = await ChatMember.find({
    userId,
    leftAt: { $exists: false },
  })
    .select("conversationId userId role canEditInfo lastReadSeq muted pinned chatTheme themeExplicit wallpaperAttachmentId themeAccent themeDark")
    .lean();
  const allRooms = await ChatConversation.find({
    _id: { $in: memberships.map((m) => m.conversationId) },
    $or: [{kind:{$ne:"support"}}, {directKey:`support:${userId}`}, {lastSeq:{$gt:0}}],
  })
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .limit(100)
    .lean();
  // Empty auto-created support inboxes are not personal conversations. Keep all replies.
  const rooms = allRooms.filter(c => c.kind !== "support" || c.directKey === `support:${userId}` || c.lastSeq > 0);
  const roomAvatars = await ChatAttachment.find({
    _id: { $in: [...rooms.map((c) => c.avatarAttachmentId), ...memberships.map(m => m.wallpaperAttachmentId)].filter(Boolean) },
  })
    .select("name mime size kind")
    .lean();
  const directIds = rooms
    .filter((c) => c.kind === "direct" || c.kind === "support")
    .map((c) => c._id);
  const others = await ChatMember.find({
    conversationId: { $in: directIds },
    userId: { $ne: userId },
    leftAt: { $exists: false },
  })
    .select("conversationId userId lastReadSeq")
    .lean();
  const profiles = await User.find({
    _id: { $in: others.map((m) => m.userId) },
  })
    .select(userFields)
    .lean();
  const admin = await siteAdmin(userId);
  const lastMessages = rooms.length
    ? await ChatMessage.find({
        $or: rooms.map((c) => ({
          conversationId: c._id,
          seq: c.lastMessageSeq,
        })),
        hiddenFor: { $ne: userId },
      })
        .select("conversationId text deletedAt attachmentIds senderId")
        .lean()
    : [];
  // Membership-scoped latest received message, independent of the last outgoing message.
  const incomingRows = rooms.length ? await ChatMessage.aggregate([
    { $match: { conversationId: { $in: rooms.map(c => c._id) }, senderId: { $ne: userId }, hiddenFor: { $ne: userId }, deletedAt: { $exists: false } } },
    { $sort: { conversationId: 1, seq: -1 } },
    { $group: { _id: "$conversationId", message: { $first: "$$ROOT" } } },
    { $project: { _id: 1, "message.senderId": 1, "message.text": 1, "message.seq": 1, "message.createdAt": 1, "message.attachmentIds": 1 } },
  ]) : [];
  const unreadRows = rooms.length
    ? await ChatMessage.aggregate<{ _id: Types.ObjectId; count: number }>([
        {
          $match: {
            $or: rooms.map((c) => ({
              conversationId: c._id,
              seq: {
                $gt: memberships.find(
                  (m) => String(m.conversationId) === String(c._id),
                )!.lastReadSeq,
              },
            })),
            senderId: { $ne: userId },
            hiddenFor: { $ne: userId },
            deletedAt: { $exists: false },
          },
        },
        { $group: { _id: "$conversationId", count: { $sum: 1 } } },
      ])
    : [];
  return rooms.map((c) => {
    const member = memberships.find(
      (m) => String(m.conversationId) === String(c._id),
    )!;
    const other = others.find(
      (m) => String(m.conversationId) === String(c._id),
    );
    const profile = profiles.find(
      (p) => String(p._id) === String(other?.userId),
    );
    const last = lastMessages.find(
      (m) => String(m.conversationId) === String(c._id),
    );
    return {
      id: String(c._id),
      kind: c.kind,
      systemKey: c.systemKey ?? null,
      isOfficial: Boolean(c.systemKey || (c.kind === "support" && c.directKey === `support:${userId}`)),
      title:
        c.kind === "support" && c.directKey === `support:${userId}`
          ? "Logic Coin Support"
          : (profile?.name ?? c.title),
      description: c.description,
      username: c.username ?? null,
      visibility: c.visibility,
      chatTheme: {
        preset: member.chatTheme === "green" && !member.themeExplicit ? "system" : member.chatTheme ?? "system",
        accent: member.themeAccent ?? null,
        dark: member.themeDark ?? false,
        wallpaperUrl: (() => {
          const image = roomAvatars.find(a => String(a._id) === String(member.wallpaperAttachmentId));
          return image ? attachmentView(image, userId, sessionId).url : null;
        })(),
      },
      avatarUrl: (() => {
        const a = roomAvatars.find(
          (a) => String(a._id) === String(c.avatarAttachmentId),
        );
        return a ? attachmentView(a, userId, sessionId).url : null;
      })(),
      peer: profile ? chatProfile(profile) : null,
      unread:
        unreadRows.find((row) => String(row._id) === String(c._id))?.count ?? 0,
      lastSeq: c.lastMessageSeq,
      peerReadSeq: other?.lastReadSeq ?? 0,
      lastMessageAt:
        c.lastMessageAt?.toISOString() ?? c.createdAt.toISOString(),
      incoming: (() => {
        const message = incomingRows.find(row => String(row._id) === String(c._id))?.message;
        return message ? { senderId: String(message.senderId), preview: message.text ?? "", hasAttachment: Boolean(message.attachmentIds?.length), at: new Date(message.createdAt).toISOString(), seq: message.seq } : null;
      })(),
      preview: last?.deletedAt ? "" : (last?.text ?? ""),
      hasAttachment: Boolean(last?.attachmentIds.length),
      muted: member.muted,
      pinned: member.pinned,
      canPost: canPostChat({
        kind: c.kind,
        systemKey: c.systemKey,
        siteAdmin: admin,
        memberRole: member.role,
      }),
      canManage: admin || member.role === "owner" || member.role === "admin",
      canEditInfo:
        admin ||
        member.role === "owner" ||
        member.role === "admin" ||
        Boolean(member.canEditInfo && !c.systemKey),
      canPromote: admin || member.role === "owner",
      isOwner: member.role === "owner",
      inviteCode: c.inviteCode ?? null,
    };
  });
}

const friendPair = (a: string | Types.ObjectId, b: string | Types.ObjectId) => [String(a), String(b)].sort().join(":");

async function safeChatBulk(model: Model<any>, operations: any[]) {
  if(!operations.length) return;
  try {await model.bulkWrite(operations,{ordered:false});}
  catch(error) {const errors=(error as {writeErrors?:{code:number}[]}).writeErrors;if(!errors?.length || errors.some(item=>item.code!==11000))throw error;}
}
/** A persisted invitation is mutual consent to connect; never connect unrelated or blocked users. */
export async function syncReferralFriends(userId: Types.ObjectId) {
  const links=await User.find({$or:[{_id:userId,referredBy:{$exists:true}},{referredBy:userId}]}).select("_id referredBy").lean();
  const edges=[...new Map(links.filter(u=>u.referredBy && String(u._id)!==String(u.referredBy)).map(u=>[friendPair(u._id,u.referredBy!),{a:u._id,b:u.referredBy!,key:friendPair(u._id,u.referredBy!)}])).values()];
  if(!edges.length)return;
  const ids=[...new Set(edges.flatMap(e=>[String(e.a),String(e.b)]))];
  const [existingUsers,blocks,relations,rooms]=await Promise.all([
    User.distinct("_id",{_id:{$in:ids}}),
    ChatBlock.find({userId:{$in:ids},blockedId:{$in:ids}}).select("userId blockedId").lean(),
    ChatFriendship.find({pairKey:{$in:edges.map(e=>e.key)}}).select("pairKey status").lean(),
    ChatConversation.find({directKey:{$in:edges.map(e=>e.key)}}).select("_id directKey").lean()
  ]);
  const memberships=await ChatMember.find({conversationId:{$in:rooms.map(r=>r._id)}}).select("conversationId userId").lean();
  const membersByRoom=new Map<string,Set<string>>();
  for(const member of memberships){const key=String(member.conversationId);if(!membersByRoom.has(key))membersByRoom.set(key,new Set());membersByRoom.get(key)!.add(String(member.userId));}
  const accepted=new Set(relations.filter(r=>r.status==="accepted").map(r=>r.pairKey)),roomByKey=new Map(rooms.map(r=>[r.directKey,r]));
  const validIds=new Set(existingUsers.map(String)),blocked=new Set(blocks.map(b=>friendPair(b.userId,b.blockedId)));
  const pending=edges.filter(e=>{const room=roomByKey.get(e.key),members=room?membersByRoom.get(String(room._id)):undefined;return validIds.has(String(e.a)) && validIds.has(String(e.b)) && !blocked.has(e.key) && (!accepted.has(e.key) || !members?.has(String(e.a)) || !members.has(String(e.b)));});
  if(!pending.length)return;
  await safeChatBulk(ChatFriendship,pending.map(e=>({updateOne:{filter:{pairKey:e.key},update:{$set:{status:"accepted"},$setOnInsert:{pairKey:e.key,requesterId:e.b,recipientId:e.a}},upsert:true}})));
  await safeChatBulk(ChatConversation,pending.map(e=>({updateOne:{filter:{directKey:e.key},update:{$setOnInsert:{directKey:e.key,kind:"direct"}},upsert:true}})));
  const connected=await ChatConversation.find({directKey:{$in:pending.map(e=>e.key)}}).select("_id directKey").lean();
  await safeChatBulk(ChatMember,connected.flatMap(room=>{const edge=pending.find(e=>e.key===room.directKey)!;return [edge.a,edge.b].map(id=>({updateOne:{filter:{conversationId:room._id,userId:id},update:{$setOnInsert:{conversationId:room._id,userId:id,role:"member"}},upsert:true}}));}));
  notifyChatChange([...new Set(pending.flatMap(e=>[String(e.a),String(e.b)]))],"friends");
}
export async function listFriendDirectory(userId:Types.ObjectId,query:string,cursor?:string) {
  const blocks=await ChatBlock.find({$or:[{userId},{blockedId:userId}]}).select("userId blockedId").lean();
  const excluded=[userId,...blocks.map(b=>String(b.userId)===String(userId)?b.blockedId:b.userId)];
  const text=query.trim().replace(/^@/,"");
  const users=await User.find({_id:{$nin:excluded,...(cursor?{$gt:oid(cursor)}:{})},...(text?{$or:[{name:new RegExp(escapeRegex(text),"i")},{username:new RegExp(escapeRegex(text),"i")}]}:{})}).sort({_id:1}).select(userFields).limit(51).lean();
  const page=users.slice(0,50),relations=await ChatFriendship.find({pairKey:{$in:page.map(p=>friendPair(userId,p._id))}}).lean();
  return {users:page.map(p=>{const relation=relations.find(r=>r.pairKey===friendPair(userId,p._id));return {...chatProfile(p),friendship:!relation?"none":relation.status==="accepted"?"friends":String(relation.requesterId)===String(userId)?"outgoing":"incoming"};}),next:users.length>50?String(page[49]!._id):null};
}
export async function friendshipStatus(userId: Types.ObjectId, targetId: string) {
  if (String(userId) === targetId) return "self";
  const relation = await ChatFriendship.findOne({pairKey: friendPair(userId, targetId)}).lean();
  return !relation ? "none" : relation.status === "accepted" ? "friends" : String(relation.requesterId) === String(userId) ? "outgoing" : "incoming";
}
export async function canDirectMessage(userId: Types.ObjectId, targetId: string) {
  // Staff may start a conversation; its recipient may reply. Blocks are checked separately.
  if (await User.exists({_id: {$in: [userId, oid(targetId)]}, role: {$in: ["manager", "admin", "owner"]}})) return true;
  return await friendshipStatus(userId, targetId) === "friends";
}
async function requireFriend(userId: Types.ObjectId, targetId: string) {
  if (await canDirectMessage(userId, targetId)) return;
  if (await friendshipStatus(userId, targetId) !== "friends") return fail(403, "friendship_required", "Accept a friend request first");
}
export async function requestFriend(userId: Types.ObjectId, targetId: string) {
  if (String(userId) === targetId) return fail(400, "chat_self", "Choose another user");
  if (!await User.exists({_id: targetId})) return fail(404, "user_not_found", "User not found");
  if (await ChatBlock.exists({$or:[{userId,blockedId:oid(targetId)},{userId:oid(targetId),blockedId:userId}]})) return fail(403,"chat_blocked","This user is unavailable");
  await ChatFriendship.updateOne({pairKey:friendPair(userId,targetId)},{$setOnInsert:{pairKey:friendPair(userId,targetId),requesterId:userId,recipientId:oid(targetId),status:"pending"}},{upsert:true}).catch(error=>{if(error?.code!==11000) throw error;});
  notifyChatChange([String(userId),targetId], "friends");
  return {status:await friendshipStatus(userId,targetId)};
}
export async function listFriends(userId: Types.ObjectId, query: string) {
  const rows=await ChatFriendship.find({status:"accepted",$or:[{requesterId:userId},{recipientId:userId}]}).select("requesterId recipientId").lean();
  const ids=rows.map(row=>String(row.requesterId)===String(userId)?row.recipientId:row.requesterId);
  const people=await User.find({_id:{$in:ids},...(query.trim()?{$or:[{name:new RegExp(escapeRegex(query.trim()),"i")},{username:new RegExp(escapeRegex(query.trim().replace(/^@/,"")),"i")}]}:{})}).select(userFields).limit(100).lean();
  return {users:people.map(chatProfile)};
}
export async function listFriendRequests(userId: Types.ObjectId) {
  const rows = await ChatFriendship.find({recipientId:userId,status:"pending"}).sort({createdAt:-1}).limit(200).lean();
  const people=await User.find({_id:{$in:rows.map(r=>r.requesterId)}}).select(userFields).lean();
  return {requests:rows.flatMap(row=>{const person=people.find(p=>String(p._id)===String(row.requesterId));return person?[{...chatProfile(person),requestedAt:row.createdAt.toISOString()}]:[];})};
}
export async function answerFriend(userId: Types.ObjectId,targetId: string,accept: boolean) {
  const pairKey=friendPair(userId,targetId);
  if (accept) {
    if (await ChatBlock.exists({$or:[{userId,blockedId:oid(targetId)},{userId:oid(targetId),blockedId:userId}]})) return fail(403,"chat_blocked","This user is unavailable");
    const row=await ChatFriendship.findOneAndUpdate({pairKey,recipientId:userId,status:"pending"},{$set:{status:"accepted"}},{new:true});
    if(!row && await friendshipStatus(userId,targetId)!=="friends") return fail(404,"request_not_found","Friend request not found");
    const room=await createDirect(userId,targetId);
    notifyChatChange([String(userId),targetId], "friends");
    return {status:"friends",id:room.id};
  }
  await ChatFriendship.deleteOne({pairKey,recipientId:userId,status:"pending"});
  notifyChatChange([String(userId),targetId], "friends");
  return {status:"none"};
}
export async function createDirect(userId: Types.ObjectId, targetId: string) {
  if (String(userId) === targetId)
    return fail(400, "chat_self", "Choose another user");
  if (!(await User.exists({ _id: targetId })))
    return fail(404, "user_not_found", "User not found");
  if (await ChatBlock.exists({$or:[{userId,blockedId:oid(targetId)},{userId:oid(targetId),blockedId:userId}]})) return fail(403,"chat_blocked","Messages are unavailable for this conversation");
  await Promise.all([
    ensureChatDefaults(userId),
    ensureChatDefaults(oid(targetId)),
  ]);
  const support = await ChatConversation.findOne({
    kind: "support",
    $or: [
      { directKey: `support:${userId}`, ownerId: oid(targetId) },
      { directKey: `support:${targetId}`, ownerId: userId },
    ],
  })
    .select("_id")
    .lean();
  if (support) return { id: String(support._id) };
  await requireFriend(userId, targetId);
  const directKey = [String(userId), targetId].sort().join(":");
  const c = await ChatConversation.findOneAndUpdate(
    { directKey },
    { $setOnInsert: { directKey, kind: "direct" } },
    { new: true, upsert: true },
  );
  await Promise.all([
    ensureMember(c._id, userId),
    ensureMember(c._id, oid(targetId)),
  ]);
  await changed(c);
  return { id: String(c._id) };
}
export async function createRoom(
  userId: Types.ObjectId,
  input: {
    kind: "group" | "channel";
    title: string;
    description: string;
    visibility: "public" | "invite";
    username?: string;
  },
) {
  if (
    (await ChatConversation.countDocuments({
      ownerId: userId,
      systemKey: { $exists: false },
    })) >= 20
  )
    return fail(
      409,
      "chat_room_limit",
      "You can own up to 20 groups and channels",
    );
  const username = input.username?.trim() ? normalizeUsername(input.username) : null;
  if (input.username?.trim() && !username) return fail(400, "invalid_username", "Use 4–24 Latin letters, numbers or underscores, starting with a letter");
  if (username && await ChatConversation.exists({ username })) return fail(409, "username_taken", "This username is already taken");
  const c = await ChatConversation.create({
    ...input,
    username: username ?? undefined,
    ownerId: userId,
    inviteCode: randomBytes(18).toString("base64url"),
  }).catch(error => {
    if (error?.code === 11000) return fail(409, "username_taken", "This username is already taken");
    throw error;
  });
  await ensureMember(c._id, userId, "owner");
  return { id: String(c._id) };
}
export async function joinRoom(userId: Types.ObjectId, code: string) {
  const c = await ChatConversation.findOne({
    inviteCode: code,
    kind: { $in: ["group", "channel"] },
  });
  if (!c) return fail(404, "chat_not_found", "Invalid invite link");
  if (c.visibility !== "public" && !(await ChatMember.exists({ conversationId: c._id, userId, leftAt: { $exists: false } })))
    return fail(403, "chat_private", "Only an administrator can add you to this private chat");
  await ChatMember.updateOne(
    { conversationId: c._id, userId },
    {
      $setOnInsert: { conversationId: c._id, userId, lastReadSeq: c.lastSeq },
      $unset: { leftAt: 1 },
    },
    { upsert: true },
  );
  await changed(c);
  return { id: String(c._id) };
}
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export async function searchChats(userId: Types.ObjectId, q: string) {
  const text = q.trim().replace(/^@/, "");
  if (text.length < 2) return { users: [], rooms: [], messages: [] };
  const regex = new RegExp(escapeRegex(text), "i");
  const users = await User.find({
    _id: { $ne: userId },
    $or: [
      { username: new RegExp(`^${escapeRegex(text)}`, "i") },
      { name: regex },
      { email: new RegExp(`^${escapeRegex(text)}$`, "i") },
      { telegramUsername: new RegExp(`^${escapeRegex(text)}$`, "i") },
      { "providers.telegramSub": text },
      { referralCode: text.toUpperCase() },
      ...(Types.ObjectId.isValid(text) ? [{ _id: oid(text) }] : []),
    ],
  })
    .select(userFields)
    .limit(20)
    .lean();
  const rooms = await ChatConversation.find({
    visibility: "public",
    kind: { $in: ["group", "channel"] },
    $or: [{ title: regex }, { username: new RegExp(`^${escapeRegex(text)}`, "i") }],
  })
    .select("title username kind description inviteCode")
    .limit(20)
    .lean();
  const memberships = await ChatMember.find({
    userId,
    leftAt: { $exists: false },
  })
    .select("conversationId")
    .lean();
  const messages = await ChatMessage.find({
    conversationId: { $in: memberships.map((m) => m.conversationId) },
    hiddenFor: { $ne: userId },
    deletedAt: { $exists: false },
    text: regex,
  })
    .sort({ createdAt: -1 })
    .limit(30)
    .select("conversationId text")
    .maxTimeMS(3000)
    .lean();
  return {
    messages: messages.map((m) => ({
      id: String(m._id),
      conversationId: String(m.conversationId),
      text: m.text.slice(0, 240),
    })),
    users: users.map(chatProfile),
    rooms: rooms.map((c) => ({
      id: String(c._id),
      title: c.title,
      username: c.username ?? null,
      kind: c.kind,
      description: c.description,
      inviteCode: c.inviteCode,
    })),
  };
}
export async function updateUsername(userId: Types.ObjectId, raw: string) {
  const username = normalizeUsername(raw);
  if (raw.trim() && !username)
    return fail(
      400,
      "invalid_username",
      "Use 4–24 Latin letters, digits or underscores; start with a letter",
    );
  try {
    await User.updateOne(
      { _id: userId },
      username ? { $set: { username } } : { $unset: { username: 1 } },
    );
  } catch (error) {
    if ((error as { code?: number }).code === 11000)
      return fail(409, "username_taken", "This username is already taken");
    throw error;
  }
  return { username };
}
const ticket = (
  userId: string,
  sessionId: string,
  attachmentId: string,
  expires: number,
) =>
  createHmac("sha256", env.JWT_SECRET)
    .update(`chat-media:${userId}:${sessionId}:${attachmentId}:${expires}`)
    .digest("hex");
function attachmentView(
  a: { _id: unknown; name: string; mime: string; kind: string; size: number },
  userId: Types.ObjectId,
  sessionId: string,
) {
  const expires = Date.now() + 10 * 60_000,
    id = String(a._id);
  return {
    id,
    name: a.name,
    mime: a.mime,
    kind: a.kind,
    size: a.size,
    url: `/api/v1/chat/media/${id}?u=${userId}&s=${sessionId}&e=${expires}&t=${ticket(String(userId), sessionId, id, expires)}`,
  };
}
export async function listMessages(
  userId: Types.ObjectId,
  sessionId: string,
  id: string,
  before?: number,
  query?: string,
) {
  const { c } = await chatAccess(userId, id);
  const rows = await ChatMessage.find({
    conversationId: c._id,
    hiddenFor: { $ne: userId },
    ...(before ? { seq: { $lt: before } } : {}),
    ...(query
      ? {
          text: new RegExp(escapeRegex(query), "i"),
          deletedAt: { $exists: false },
        }
      : {}),
  })
    .sort({ seq: -1 })
    .limit(41)
    .lean();
  const pinnedMessages = await ChatMessage.find({ conversationId: c._id, pinned: true, hiddenFor: { $ne: userId }, deletedAt: { $exists: false } })
    .select("seq text attachmentIds").sort({ seq: -1 }).limit(100).lean();
  const selected = rows.slice(0, 40);
  const commentCounts = c.kind === "channel" ? await ChatComment.aggregate<{_id:Types.ObjectId;count:number}>([{$match:{messageId:{$in:selected.map(m=>m._id)},conversationId:c._id,deletedAt:{$exists:false}}},{$group:{_id:"$messageId",count:{$sum:1}}}]) : [];

  const listened = await ChatVoiceReceipt.find({ userId, messageId: { $in: selected.map(m => m._id) } }).select("messageId").lean();
  const replyIds = selected.map((m) => m.replyTo).filter(Boolean);
  const quoted = await ChatMessage.find({
    _id: { $in: replyIds },
    conversationId: c._id,
    hiddenFor: { $ne: userId },
  })
    .select("text senderId deletedAt")
    .lean();
  const profiles = await User.find({
    _id: {
      $in: [
        ...selected.map((m) => m.senderId),
        ...quoted.map((m) => m.senderId),
        ...selected.flatMap(m => [...new Set(m.reactions.map(r => r.emoji))].flatMap(emoji => m.reactions.filter(r => r.emoji === emoji).slice(0, 3).map(r => r.userId))),
      ],
    },
  })
    .select(userFields)
    .lean();
  const assets = await ChatAttachment.find({
    _id: {
      $in: selected.filter((m) => !m.deletedAt).flatMap((m) => m.attachmentIds),
    },
  })
    .select("name mime size kind")
    .lean();
  const reactionProfiles = new Map(profiles.map(profile => [String(profile._id), chatProfile(profile)]));
  return {
    pinned: pinnedMessages.map(m => ({ id: String(m._id), seq: m.seq, text: m.text, hasAttachments: Boolean(m.attachmentIds.length) })),
    items: selected.reverse().map((m) => {
      const sender = profiles.find((p) => String(p._id) === String(m.senderId));
      const quote = quoted.find((q) => String(q._id) === String(m.replyTo));
      return {
        id: String(m._id),
        seq: m.seq,
        ...(c.kind === "channel" ? {commentCount:commentCounts.find(row=>String(row._id)===String(m._id))?.count??0} : {}),
        sender: sender
          ? chatProfile(sender)
          : { id: String(m.system?.recipientId ?? m.senderId), name: m.system ? "Logic Coin" : "User", avatarUrl: null },
        ...(m.system && !m.deletedAt ? { system: { kind: m.system.kind, recipientId: String(m.system.recipientId), recipientName: m.system.recipientName, ...(m.system.amountCents != null ? { amountCents: m.system.amountCents } : {}), ...(m.system.kind === "raffle_winner" ? { raffleTitle: m.system.raffleTitle, ...(m.system.prizeText ? { prizeText: m.system.prizeText } : {}) } : {}) } } : {}),
        text: m.deletedAt ? "" : m.text,
        createdAt: m.createdAt.toISOString(),
        edited: Boolean(m.editedAt),
        deleted: Boolean(m.deletedAt),
        pinned: m.pinned,
        forwardedFrom: m.forwardedFrom ?? null,
        reply: quote
          ? {
              id: String(quote._id),
              text: quote.deletedAt ? "" : quote.text.slice(0, 160),
              sender:
                profiles.find((p) => String(p._id) === String(quote.senderId))
                  ?.name ?? "User",
            }
          : null,
        attachments: m.deletedAt
          ? []
          : assets
              .filter((a) =>
                m.attachmentIds.some((id) => String(id) === String(a._id)),
              )
              .map((a) => attachmentView(a, userId, sessionId)),
        reactions: m.deletedAt
          ? []
          : m.reactions.map((r) => ({
              userId: String(r.userId),
              emoji: r.emoji,
              user: reactionProfiles.get(String(r.userId)),
            })),
        own: !m.system && String(m.senderId) === String(userId),
        voiceListened: listened.some(receipt => String(receipt.messageId) === String(m._id)),
      };
    }),
    before: rows.length > 40 ? (selected[0]?.seq ?? null) : null,
  };
}
export async function sendChatMessage(
  userId: Types.ObjectId,
  id: string,
  input: {
    clientId: string;
    text: string;
    attachmentIds: string[];
    replyTo?: string;
    forwardId?: string;
  },
) {
  const { c } = await chatAccess(userId, id, true);
  const previous = await ChatMessage.findOne({
    conversationId: c._id,
    senderId: userId,
    clientId: input.clientId,
  })
    .select("_id seq")
    .lean();
  if (previous) return { id: String(previous._id), seq: previous.seq };
  let text = input.text,
    attachmentIds = input.attachmentIds.map(oid),
    forwardedFrom: string | undefined;
  if (input.forwardId) {
    const source = await ChatMessage.findOne({
      _id: input.forwardId,
      deletedAt: { $exists: false },
      hiddenFor: { $ne: userId },
    }).lean();
    if (!source) return fail(404, "message_not_found", "Message not found");
    await chatAccess(userId, String(source.conversationId));
    if (source.system) return fail(403, "system_message", "System messages cannot be forwarded");
    text = source.text;
    attachmentIds = source.attachmentIds;
    const author = await User.findById(source.senderId).select("name").lean();
    forwardedFrom = source.forwardedFrom || author?.name || "User";
  } else if (
    attachmentIds.length &&
    (await ChatAttachment.countDocuments({
      _id: { $in: attachmentIds },
      ownerId: userId,
    })) !== attachmentIds.length
  )
    return fail(403, "attachment_denied", "Invalid attachment");
  if (!text.trim() && !attachmentIds.length)
    return fail(400, "empty_message", "Write a message or attach a file");
  if (
    input.replyTo &&
    !(await ChatMessage.exists({
      _id: input.replyTo,
      conversationId: c._id,
      hiddenFor: { $ne: userId },
    }))
  )
    return fail(400, "invalid_reply", "Reply must belong to this chat");
  const next = await ChatConversation.findByIdAndUpdate(
    c._id,
    { $inc: { lastSeq: 1 }, $set: { lastMessageAt: new Date() } },
    { new: true },
  );
  let message;
  try {
    message = await ChatMessage.create({
      conversationId: c._id,
      senderId: userId,
      clientId: input.clientId,
      seq: next!.lastSeq,
      text,
      attachmentIds,
      replyTo: input.replyTo,
      forwardedFrom,
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const duplicate = await ChatMessage.findOne({
      conversationId: c._id,
      senderId: userId,
      clientId: input.clientId,
    }).lean();
    if (!duplicate) throw error;
    return { id: String(duplicate._id), seq: duplicate.seq };
  }
  await ChatConversation.updateOne(
    { _id: c._id, lastMessageSeq: { $lt: message.seq } },
    { $set: { lastMessageSeq: message.seq, lastMessageAt: message.createdAt } },
  );
  await ChatMember.updateOne(
    { conversationId: c._id, userId },
    { $max: { lastReadSeq: message.seq } },
  );
  await changed(c);
  // Large default community/news feeds notify in-app; push is opt-in per chat.
  const recipients = await ChatMember.distinct("userId", {
    conversationId: c._id,
    userId: { $ne: userId },
    leftAt: { $exists: false },
    muted: false,
  });
  if (recipients.length)
    await NotificationEvent.updateOne(
      { eventKey: `chat:${message._id}` },
      {
        $setOnInsert: {
          eventKey: `chat:${message._id}`,
          type: "chat_message",
          audience: "specific_users",
          payload: {
            userIds: recipients.map(String),
            conversationId: id,
            seq: message.seq,
            title: c.title || "Logic Coin",
            body: text.slice(0, 160) || "📎",
            expiresAt: new Date(Date.now() + 86400_000).toISOString(),
          },
        },
      },
      { upsert: true },
    );
  return { id: String(message._id), seq: message.seq };
}
export async function changeMessage(
  userId: Types.ObjectId,
  id: string,
  action: {
    text?: string;
    remove?: "self" | "all";
    emoji?: string;
    pinned?: boolean;
    report?: string;
  },
) {
  const m = await ChatMessage.findById(id);
  if (!m || m.hiddenFor.some((u) => String(u) === String(userId)))
    return fail(404, "message_not_found", "Message not found");
  const { c, member, admin } = await chatAccess(
    userId,
    String(m.conversationId),
  );
  if (m.system && action.text !== undefined)
    return fail(403, "system_message", "System messages cannot be edited");
  const own = String(m.senderId) === String(userId),
    moderator = admin || member.role === "owner" || member.role === "admin";
  if (action.report) {
    await ChatReport.create({
      userId,
      messageId: m._id,
      reason: action.report,
    });
    return { ok: true };
  }
  if (action.remove === "self") {
    await ChatMessage.updateOne(
      { _id: m._id },
      { $addToSet: { hiddenFor: userId } },
    );
    return { ok: true };
  }
  if (action.remove === "all") {
    if (!own && !moderator)
      return fail(403, "message_forbidden", "You cannot delete this message");
    m.deletedAt = new Date();
    m.text = "";
    m.attachmentIds = [];
    m.reactions.splice(0);
  } else if (m.deletedAt)
    return fail(409, "message_deleted", "Message was deleted");
  else if (action.text !== undefined) {
    if (!own)
      return fail(
        403,
        "message_forbidden",
        "You can edit only your own messages",
      );
    m.text = action.text;
    m.editedAt = new Date();
  } else if (action.emoji !== undefined) {
    // Atomic pipeline prevents reactions from overwriting concurrent replies.
    await ChatMessage.updateOne({ _id: m._id, deletedAt: { $exists: false } }, [
      {
        $set: {
          reactions: {
            $concatArrays: [
              {
                $filter: {
                  input: "$reactions",
                  as: "r",
                  cond: { $ne: ["$$r.userId", userId] },
                },
              },
              ...(action.emoji ? [[{ userId, emoji: action.emoji }]] : [[]]),
            ],
          },
        },
      },
    ]);
    await changed(c);
    return { ok: true };
  } else if (action.pinned !== undefined) {
    if (!moderator)
      return fail(
        403,
        "message_forbidden",
        "Only administrators can pin messages",
      );
    m.pinned = action.pinned;
  }
  await m.save();
  await changed(c);
  return { ok: true };
}
export async function updateChatMember(
  userId: Types.ObjectId,
  id: string,
  input: {
    muted?: boolean;
    pinned?: boolean;
    readSeq?: number;
    leave?: boolean;
    targetId?: string;
    role?: "admin" | "member";
    canEditInfo?: boolean;
    remove?: boolean;
  },
) {
  const { c, member, admin } = await chatAccess(userId, id);
  if (input.targetId) {
    if (
      (!admin && member.role !== "owner" && member.role !== "admin") ||
      ["direct", "support"].includes(c.kind) ||
      c.systemKey
    )
      return fail(403, "chat_forbidden", "Cannot manage this member");
    const target = await ChatMember.findOne({
      conversationId: c._id,
      userId: input.targetId,
      leftAt: { $exists: false },
    });
    if (
      !target ||
      target.role === "owner" ||
      (!admin && member.role !== "owner" && target.role === "admin")
    )
      return fail(403, "chat_forbidden", "Cannot change this member");
    if (
      (input.role || input.canEditInfo !== undefined) &&
      !admin &&
      member.role !== "owner"
    )
      return fail(
        403,
        "chat_forbidden",
        "Only the owner can appoint administrators",
      );
    if (input.remove) {
      target.leftAt = new Date();
      target.canEditInfo = false;
    } else if (input.role) {
      target.role = input.role;
      target.canEditInfo = false;
    } else if (input.canEditInfo !== undefined)
      target.canEditInfo = input.canEditInfo;
    await target.save();
  } else {
    if (
      input.leave &&
      (c.systemKey || member.role === "owner" || c.kind === "support")
    )
      return fail(400, "chat_cannot_leave", "This chat cannot be left");
    await ChatMember.updateOne(
      { _id: member._id },
      {
        ...(input.readSeq !== undefined
          ? { $max: { lastReadSeq: Math.min(input.readSeq, c.lastSeq) } }
          : {}),
        $set: {
          ...(input.muted !== undefined ? { muted: input.muted } : {}),
          ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
          ...(input.leave ? { leftAt: new Date() } : {}),
        },
      },
    );
  }
  const readIds: string[] = [];
  if (input.readSeq !== undefined) {
    const notices = await NotificationEvent.find({
      type: "chat_message",
      "payload.conversationId": id,
      "payload.seq": {
        $gt: member.lastReadSeq,
        $lte: Math.min(input.readSeq, c.lastSeq),
      },
      "payload.userIds": String(userId),
    })
      .select("_id")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    readIds.push(...notices.map((n) => `event:${n._id}`));
    if (readIds.length)
      await NotificationRead.bulkWrite(
        readIds.map((notificationId) => ({
          updateOne: {
            filter: { userId, notificationId },
            update: {
              $setOnInsert: { userId, notificationId, readAt: new Date() },
            },
            upsert: true,
          },
        })),
      );
  }
  await changed(c);
  return { ok: true, readIds };
}
export async function addChatMember(
  userId: Types.ObjectId,
  id: string,
  targetId: string,
) {
  const { c, member, admin } = await chatAccess(userId, id);
  if (
    c.systemKey ||
    !["group", "channel"].includes(c.kind) ||
    (!admin && !["owner", "admin"].includes(member.role ?? ""))
  )
    return fail(403, "chat_forbidden", "Cannot add participants to this chat");
  if (!(await User.exists({ _id: targetId })))
    return fail(404, "user_not_found", "User not found");
  if (
    await ChatBlock.exists({
      $or: [
        { userId, blockedId: oid(targetId) },
        { userId: oid(targetId), blockedId: userId },
      ],
    })
  )
    return fail(403, "chat_blocked", "This user cannot be added");
  if (await friendshipStatus(userId, targetId) !== "friends") return fail(403, "friendship_required", "Accept a friend request first");
  const target = await ensureMember(c._id, oid(targetId));
  if (target.leftAt)
    await ChatMember.updateOne(
      { _id: target._id, leftAt: { $exists: true } },
      {
        $unset: { leftAt: 1 },
        $set: {
          role: "member",
          canEditInfo: false,
          lastReadSeq: c.lastMessageSeq,
        },
      },
    );
  await changed(c);
  return { ok: true };
}
export async function chatMembers(userId: Types.ObjectId, id: string) {
  const { c } = await chatAccess(userId, id);
  const members = await ChatMember.find({
    conversationId: c._id,
    leftAt: { $exists: false },
  })
    .sort({ role: 1 })
    .limit(100)
    .lean();
  const users = await User.find({ _id: { $in: members.map((m) => m.userId) } })
    .select(userFields)
    .lean();
  return {
    count: await ChatMember.countDocuments({
      conversationId: c._id,
      leftAt: { $exists: false },
    }),
    members: users.map((u) => ({
      ...chatProfile(u),
      role: members.find((m) => String(m.userId) === String(u._id))!.role,
      canEditInfo: Boolean(
        members.find((m) => String(m.userId) === String(u._id))!.canEditInfo,
      ),
    })),
  };
}
export async function uploadChatAttachment(
  userId: Types.ObjectId,
  input: {
    name: string;
    mime: string;
    kind: "photo" | "file" | "voice";
    base64: string;
  },
) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64))
    return fail(400, "invalid_attachment", "Invalid file encoding");
  return uploadChatAttachmentBuffer(userId, input, Buffer.from(input.base64, "base64"));
}
export async function uploadChatAttachmentBuffer(
  userId: Types.ObjectId,
  input: { name: string; mime: string; kind: "photo" | "file" | "voice" },
  data: Buffer,
) {
  let bytes: Buffer<ArrayBufferLike> = data, mime = input.mime;
  if (!bytes.length || bytes.length > 200 * 1024 * 1024)
    return fail(400, "attachment_too_large", "Maximum file size is 200 MB");
  const usage = await ChatAttachment.aggregate<{ bytes: number }>([
    {
      $match: {
        ownerId: userId,
        createdAt: { $gte: new Date(Date.now() - 86400_000) },
      },
    },
    { $group: { _id: null, bytes: { $sum: "$size" } } },
  ]);
  if ((usage[0]?.bytes ?? 0) + bytes.length > 1024 * 1024 * 1024)
    return fail(
      429,
      "upload_quota",
      "Daily upload limit reached. Please try tomorrow",
    );
  if (input.kind === "photo") {
    try {
      bytes = await sharp(bytes, { limitInputPixels: 25_000_000 })
        .rotate()
        .resize({
          width: 1800,
          height: 1800,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
      mime = "image/webp";
    } catch {
      return fail(400, "invalid_photo", "Invalid photo");
    }
  } else {
    if (
      input.kind === "file" &&
      !["application/pdf", "text/plain"].includes(mime)
    )
      mime = "application/octet-stream";
    const valid =
      mime === "application/octet-stream"
        ? input.kind === "file"
        : mime === "application/pdf"
          ? bytes.subarray(0, 5).toString() === "%PDF-"
          : mime === "text/plain"
            ? !bytes.includes(0)
            : mime === "audio/mp4" || mime === "audio/m4a"
              ? bytes.subarray(4, 8).toString() === "ftyp"
              : mime === "audio/webm"
                ? bytes
                    .subarray(0, 4)
                    .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
                : mime === "audio/ogg"
                  ? bytes.subarray(0, 4).toString() === "OggS"
                  : false;
    if (!valid || (input.kind === "voice" && !mime.startsWith("audio/")))
      return fail(
        400,
        "unsupported_attachment",
        "Supported files: PDF, TXT, images and voice recordings",
      );
  }
  const storageKey = randomBytes(24).toString("hex");
  await mkdir(root, { recursive: true, mode: 0o700 });
  await writeFile(path.join(root, storageKey), bytes, {
    flag: "wx",
    mode: 0o600,
  });
  const a = await ChatAttachment.create({
    ownerId: userId,
    name: input.name.replace(/[\\/\r\n\x00-\x1f]/g, "_").slice(0, 180),
    kind: input.kind,
    mime,
    size: bytes.length,
    storageKey,
  });
  return { id: String(a._id), name: a.name, kind: a.kind, size: a.size };
}
export async function readChatAttachment(
  id: string,
  user: string,
  session: string,
  expires: number,
  signature: string,
) {
  if (
    !Number.isFinite(expires) ||
    expires < Date.now() ||
    expires > Date.now() + 11 * 60_000 ||
    !/^[a-f\d]{64}$/.test(signature)
  )
    return fail(
      403,
      "media_expired",
      "Open the chat again to refresh this file",
    );
  const expected = ticket(user, session, id, expires);
  if (
    !timingSafeEqual(Buffer.from(expected), Buffer.from(signature)) ||
    !(await isAccessSessionActive(oid(user), session))
  )
    return fail(403, "media_denied", "File access denied");
  const a = await ChatAttachment.findById(id).lean();
  if (!a) return fail(404, "attachment_not_found", "File not found");
  if (String(a.ownerId) !== user) {
    const memberships = await ChatMember.distinct("conversationId", {
      userId: user,
      leftAt: { $exists: false },
    });
    if (
      !(await ChatMessage.exists({
        conversationId: { $in: memberships },
        attachmentIds: a._id,
        deletedAt: { $exists: false },
        hiddenFor: { $ne: oid(user) },
      })) &&
      !(await ChatConversation.exists({
        _id: { $in: memberships },
        avatarAttachmentId: a._id,
      }))
    )
      return fail(403, "media_denied", "File access denied");
  }
  let mediaMime = a.mime;
  if (a.kind === "file" && /\.(mp4|m4v|mov|webm)$/i.test(a.name)) {
    const handle = await open(path.join(root, a.storageKey), "r");
    try { const prefix = Buffer.alloc(8);await handle.read(prefix,0,8,0);mediaMime = chatVideoMime(a.name,prefix) ?? a.mime; }
    finally { await handle.close(); }
  }
  return {
    bytes: a.kind === "file" ? Buffer.alloc(0) : await readFile(path.join(root, a.storageKey)),
    filePath: a.kind === "file" ? path.join(root, a.storageKey) : null,
    mime: mediaMime,
    name: a.name,
  };
}
export async function blockChatUser(
  userId: Types.ObjectId,
  targetId: string,
  blocked: boolean,
) {
  if (String(userId) === targetId)
    return fail(400, "invalid_block", "Cannot block yourself");
  if (blocked)
    await ChatBlock.updateOne(
      { userId, blockedId: oid(targetId) },
      { $setOnInsert: { userId, blockedId: oid(targetId) } },
      { upsert: true },
    );
  else await ChatBlock.deleteOne({ userId, blockedId: targetId });
  return { blocked };
}

export async function relaySupportReply(
  userId: Types.ObjectId,
  text: string,
  clientId: string,
) {
  await ensureChatDefaults(userId);
  const room = await ChatConversation.findOne({
    directKey: `support:${userId}`,
  })
    .select("_id")
    .lean();
  if (!room) throw new Error("Support administrator is unavailable");
  return sendChatMessage(userId, String(room._id), {
    clientId,
    text: text.slice(0, 4000),
    attachmentIds: [],
  });
}

export async function setChatTheme(userId: Types.ObjectId, id: string, input: { preset: "system" | "green" | "blue" | "pink" | "graphite" | "custom"; wallpaperAttachmentId?: string }) {
  const { member } = await chatAccess(userId, id);
  let accent: string | undefined, dark = false;
  const wallpaperId = input.wallpaperAttachmentId ?? member.wallpaperAttachmentId?.toString();
  if (input.preset === "custom") {
    const photo = wallpaperId ? await ChatAttachment.findOne({ _id: wallpaperId, ownerId: userId, kind: "photo" }).lean() : null;
    if (!photo) return fail(400, "invalid_wallpaper", "Choose a photo for this theme");
    const { dominant } = await sharp(await readFile(path.join(root, photo.storageKey))).resize(40, 40, { fit: "inside" }).stats();
    dark = dominant.r * 0.2126 + dominant.g * 0.7152 + dominant.b * 0.0722 < 135;
    accent = "#" + [dominant.r, dominant.g, dominant.b].map(value => Math.round(dark ? Math.max(115, value) : Math.min(145, value)).toString(16).padStart(2, "0")).join("");
  }
  await ChatMember.updateOne({ _id: member._id }, {
    $set: { chatTheme: input.preset, themeExplicit: input.preset !== "system", ...(input.preset === "custom" ? { themeDark: dark, themeAccent: accent, wallpaperAttachmentId: wallpaperId } : {}) },
  });
  return { ok: true };
}
export async function markVoiceListened(userId: Types.ObjectId, id: string) {
  const message = await ChatMessage.findOne({ _id: oid(id), hiddenFor: { $ne: userId }, deletedAt: { $exists: false } });
  if (!message) return fail(404, "message_not_found", "Message not found");
  await chatAccess(userId, String(message.conversationId));
  if (!(await ChatAttachment.exists({ _id: { $in: message.attachmentIds }, kind: "voice" })))
    return fail(400, "not_voice", "This message has no voice recording");
  await ChatVoiceReceipt.updateOne({ userId, messageId: message._id }, { $setOnInsert: { userId, messageId: message._id, listenedAt: new Date() } }, { upsert: true });
  return { ok: true };
}
export async function updateChatRoom(
  userId: Types.ObjectId,
  id: string,
  input: { title: string; description: string; avatarAttachmentId?: string; username?: string; visibility?: "public" | "invite" },
) {
  const { c, member, admin } = await chatAccess(userId, id);
  if (
    !["group", "channel"].includes(c.kind) ||
    (!admin &&
      member.role !== "owner" &&
      member.role !== "admin" &&
      !(member.canEditInfo && !c.systemKey))
  )
    return fail(
      403,
      "chat_forbidden",
      "Only administrators can edit this chat",
    );
  if (
    input.avatarAttachmentId &&
    !(await ChatAttachment.exists({
      _id: input.avatarAttachmentId,
      ownerId: userId,
      kind: "photo",
    }))
  )
    return fail(403, "attachment_denied", "Invalid chat photo");
  if ((input.username !== undefined || input.visibility !== undefined) && !admin && !["owner", "admin"].includes(member.role))
    return fail(403, "chat_forbidden", "Only administrators can change chat access");
  const { username: rawUsername, ...fields } = input;
  const username = rawUsername?.trim() ? normalizeUsername(rawUsername) : null;
  if (rawUsername?.trim() && !username) return fail(400, "invalid_username", "Use 4–24 Latin letters, numbers or underscores, starting with a letter");
  if (username && await ChatConversation.exists({ username, _id: { $ne: c._id } })) return fail(409, "username_taken", "This username is already taken");
  try {
    await ChatConversation.updateOne({ _id: c._id }, {
      $set: { ...fields, ...(username ? { username } : {}) },
      ...(rawUsername !== undefined && !username ? { $unset: { username: 1 } } : {}),
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return fail(409, "username_taken", "This username is already taken");
    throw error;
  }
  await changed(c);
  return { ok: true };
}
