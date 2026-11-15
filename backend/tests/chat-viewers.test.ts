import express from "express";
import request from "supertest";
import { Types } from "mongoose";
import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),findOne:vi.fn(),updateMany:vi.fn(),updateOne:vi.fn(),members:vi.fn(),users:vi.fn(),notify:vi.fn()}));
vi.mock("../src/services/chat.service.js",()=>({chatAccess:mocks.access,chatProfile:(u:unknown)=>u}));
vi.mock("../src/models/Chat.js",()=>({ChatBlock:{},ChatMember:{distinct:mocks.members},ChatMessage:{findOne:mocks.findOne,updateMany:mocks.updateMany,updateOne:mocks.updateOne}}));
vi.mock("../src/models/User.js",()=>({User:{find:mocks.users}}));
vi.mock("../src/services/live-updates.service.js",()=>({notifyChatChange:mocks.notify,connectedChatUserIds:()=>[]}));
import chatRoutes from "../src/routes/chat.routes.js";
const user=new Types.ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),room=new Types.ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb"),message="cccccccccccccccccccccccc";
const app=express();app.use(express.json());app.use((req,_res,next)=>{req.auth={userId:user,sessionId:"dddddddddddddddddddddddd"} as never;next();});app.use("/chat",chatRoutes);app.use((err:Error & {statusCode?:number},_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(err.statusCode ?? 500).end());
beforeEach(()=>{vi.clearAllMocks();mocks.access.mockResolvedValue({c:{_id:room,kind:"group"}});});
it("only looks up viewers for a message authored by the requester",async()=>{
 mocks.findOne.mockReturnValue({select:()=>({lean:async()=>null})});
 const result=await request(app).get(`/chat/${room}/messages/${message}/viewers`);
 expect(result.status).toBe(404);
 expect(mocks.findOne).toHaveBeenCalledWith(expect.objectContaining({senderId:user,conversationId:room}));
 expect(mocks.users).not.toHaveBeenCalled();
});
it("records only visible, non-deleted messages from other users in the authorized group",async()=>{
 mocks.updateMany.mockResolvedValue({});
 const result=await request(app).post(`/chat/${room}/views`).send({messageIds:[message]});
 expect(result.status).toBe(200);
 expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({conversationId:room,senderId:{$ne:user},deletedAt:{$exists:false},hiddenFor:{$ne:user}}),{$addToSet:{viewedBy:user}});
});
it("rejects a poll vote outside its available choices",async()=>{
 mocks.findOne.mockReturnValue({select:()=>({lean:async()=>({_id:new Types.ObjectId(message),poll:{options:["Yes","No"]}})})});
 const result=await request(app).post(`/chat/${room}/messages/${message}/vote`).send({option:2});
 expect(result.status).toBe(400);expect(mocks.updateOne).not.toHaveBeenCalled();
});
it("records one selected option under the authenticated user and informs members",async()=>{
 mocks.findOne.mockReturnValue({select:()=>({lean:async()=>({_id:new Types.ObjectId(message),poll:{options:["Yes","No"]}})})});
 mocks.updateOne.mockResolvedValue({});mocks.members.mockResolvedValue([user]);
 const result=await request(app).post(`/chat/${room}/messages/${message}/vote`).send({option:1});
 expect(result.status).toBe(200);
 expect(mocks.updateOne).toHaveBeenCalledWith({_id:new Types.ObjectId(message)},{$set:{[`poll.votes.${user}`]:1}});
 expect(mocks.notify).toHaveBeenCalledWith([String(user)],String(room));
});
