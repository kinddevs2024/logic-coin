import mongoose, { Types } from "mongoose";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { User } from "../src/models/User.js";
import { ChatConversation, ChatMember, ChatMessage, ChatBlock, ChatFriendship } from "../src/models/Chat.js";
import { canDirectMessage, chatAccess, listChats, createDirect, sendChatMessage } from "../src/services/chat.service.js";
const uri=process.env.QA_MONGODB_URI;
describe.skipIf(!uri)("staff posting in isolated MongoDB",()=>{
 let ids:Record<string,Types.ObjectId>,news:Types.ObjectId;
 beforeAll(async()=>{if(!uri?.startsWith("mongodb://127.0.0.1:27951/"))throw Error("Isolated database only");await mongoose.connect(uri,{dbName:`staff_channel_qa_${Date.now()}`});await Promise.all([User.init(),ChatConversation.init(),ChatMember.init(),ChatMessage.init()]);});
 beforeEach(async()=>{
  await Promise.all([User.deleteMany({}),ChatConversation.deleteMany({}),ChatMember.deleteMany({}),ChatMessage.deleteMany({}),ChatBlock.deleteMany({}),ChatFriendship.deleteMany({})]);
  ids=Object.fromEntries(["user","manager","admin","owner","other"].map(r=>[r,new Types.ObjectId()]));
  await User.create(Object.entries(ids).map(([role,_id])=>({_id,name:role,email:`${role}@test.invalid`,referralCode:`CHATROLE${role.toUpperCase()}`,role:role==="other"?"user":role})));
  news=(await ChatConversation.create({kind:"channel",systemKey:"news",title:"QA news"}))._id;
  await ChatMember.create(Object.values(ids).map(userId=>({userId,conversationId:news,role:"member",muted:true})));
 });
 afterAll(async()=>{await mongoose.connection.dropDatabase();await mongoose.disconnect();});
 const input=()=>({clientId:new Types.ObjectId().toString(),text:"Isolated QA message",attachmentIds:[]});
 it.each(["manager","admin","owner"])("%s sees composer and can publish",async role=>{
  const room=(await listChats(ids[role]!,"qa")).find(r=>r.id===String(news));expect(room?.canPost).toBe(true);
  if(role!=="admin"){expect(room?.canManage).toBe(false);expect(room?.canPromote).toBe(false);}
  const sent=await sendChatMessage(ids[role]!,String(news),input());expect(await ChatMessage.findById(sent.id)).toBeTruthy();
 });
 it("ordinary users cannot publish, even with a channel owner membership",async()=>{
  await ChatMember.updateOne({userId:ids.user,conversationId:news},{$set:{role:"owner"}});
  expect((await listChats(ids.user!,"qa")).find(r=>r.id===String(news))?.canPost).toBe(false);
  await expect(sendChatMessage(ids.user!,String(news),input())).rejects.toMatchObject({statusCode:403,code:"chat_read_only"});expect(await ChatMessage.countDocuments()).toBe(0);
 });
 it("demotion immediately revokes posting",async()=>{await chatAccess(ids.manager!,String(news),true);await User.updateOne({_id:ids.manager},{$set:{role:"user"}});await expect(sendChatMessage(ids.manager!,String(news),input())).rejects.toMatchObject({statusCode:403});});
 it.each(["manager","admin","owner"])("%s starts and writes a personal chat without friendship; recipient replies",async role=>{
  expect(await canDirectMessage(ids[role]!,String(ids.user))).toBe(true);const room=await createDirect(ids[role]!,String(ids.user));
  const sent=await sendChatMessage(ids[role]!,room.id,input());expect(sent.id).toBeTruthy();expect((await sendChatMessage(ids.user!,room.id,input())).id).toBeTruthy();
  expect(await ChatFriendship.countDocuments()).toBe(0);
 });
 it.each(["manager","owner"])("%s does not gain posting privileges in unrelated private channels",async role=>{
  const channel=await ChatConversation.create({kind:"channel",title:"Other channel"});await ChatMember.create({conversationId:channel._id,userId:ids[role],role:"member"});
  await expect(sendChatMessage(ids[role]!,String(channel._id),input())).rejects.toMatchObject({statusCode:403});
 });
 it("preserves recipient blocks",async()=>{await ChatBlock.create({userId:ids.user,blockedId:ids.owner});await expect(createDirect(ids.owner!,String(ids.user))).rejects.toMatchObject({statusCode:403,code:"chat_blocked"});});
});
