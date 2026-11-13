import { Types } from "mongoose";
import { ApiError } from "../lib/api-error.js";
import { ChatMessage } from "../models/Chat.js";
import { ChatComment } from "../models/ChatComment.js";
import { User } from "../models/User.js";
import { chatAccess, chatProfile } from "./chat.service.js";
import { notifyChatChange } from "./live-updates.service.js";
async function access(userId:Types.ObjectId,conversationId:string,messageId:string){
 const context=await chatAccess(userId,conversationId);
 if(context.c.kind!=="channel")throw new ApiError(400,"comments_unavailable","Комментарии доступны под сообщениями канала.");
 const message=await ChatMessage.findOne({_id:messageId,conversationId:context.c._id,deletedAt:{$exists:false},hiddenFor:{$ne:userId}}).select("_id").lean();
 if(!message)throw new ApiError(404,"message_not_found","Сообщение не найдено.");return context;
}
export async function listChatComments(userId:Types.ObjectId,conversationId:string,messageId:string,before?:string){
 await access(userId,conversationId,messageId);
 const rows=await ChatComment.find({messageId,conversationId,...(before?{_id:{$lt:new Types.ObjectId(before)}}:{})}).sort({_id:-1}).limit(31).lean();
 const selected=rows.slice(0,30);const quotes=await ChatComment.find({_id:{$in:selected.map(r=>r.replyTo).filter(Boolean)},messageId}).lean();
 const people=await User.find({_id:{$in:[...selected.map(r=>r.senderId),...quotes.map(r=>r.senderId)]}}).select("name username avatarUrl referralCode role").lean();
 const person=(id:Types.ObjectId)=>{const p=people.find(p=>String(p._id)===String(id));return p?chatProfile(p):{id:String(id),name:"User",avatarUrl:null};};
 return {items:selected.reverse().map(row=>{const quote=quotes.find(q=>String(q._id)===String(row.replyTo));return{id:String(row._id),sender:person(row.senderId),text:row.deletedAt?"":row.text,deleted:Boolean(row.deletedAt),own:String(row.senderId)===String(userId),createdAt:row.createdAt.toISOString(),reply:quote?{id:String(quote._id),sender:person(quote.senderId),text:quote.deletedAt?"":quote.text.slice(0,160),deleted:Boolean(quote.deletedAt)}:null};}),before:rows.length>30?String(selected[0]!._id):null,total:await ChatComment.countDocuments({messageId,conversationId,deletedAt:{$exists:false}})};
}
export async function sendChatComment(userId:Types.ObjectId,conversationId:string,messageId:string,input:{clientId:string;text:string;replyTo?:string}){
 await access(userId,conversationId,messageId);
 const filter={messageId,conversationId,senderId:userId,clientId:input.clientId};
 const replay=(row:{_id:Types.ObjectId;text:string;replyTo?:Types.ObjectId|null})=>{if(row.text!==input.text||String(row.replyTo??"")!==(input.replyTo??""))throw new ApiError(409,"comment_changed","Этот комментарий уже отправлен с другими данными.");return{id:String(row._id)};};
 const previous=await ChatComment.findOne(filter).lean();if(previous)return replay(previous);
 if(input.replyTo&&!await ChatComment.exists({_id:input.replyTo,messageId,conversationId,deletedAt:{$exists:false}}))throw new ApiError(400,"invalid_reply","Комментарий для ответа недоступен.");
 try{const row=await ChatComment.create({...filter,text:input.text,...(input.replyTo?{replyTo:input.replyTo}:{})});notifyChatChange(null,conversationId);return{id:String(row._id)};}catch(error){if((error as {code?:number}).code===11000){const duplicate=await ChatComment.findOne(filter).lean();if(duplicate)return replay(duplicate);}throw error;}
}
export async function removeChatComment(userId:Types.ObjectId,conversationId:string,messageId:string,commentId:string){
 const {admin,member}=await access(userId,conversationId,messageId);const row=await ChatComment.findOne({_id:commentId,messageId,conversationId});
 if(!row)throw new ApiError(404,"comment_not_found","Комментарий не найден.");
 if(String(row.senderId)!==String(userId)&&!admin&&!["owner","admin"].includes(member.role))throw new ApiError(403,"comment_forbidden","Нельзя удалить чужой комментарий.");
 await ChatComment.updateOne({_id:row._id},{$set:{deletedAt:new Date(),text:""}});notifyChatChange(null,conversationId);return{ok:true};
}
