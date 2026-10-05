import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { User } from "../models/User.js";
import { ApiError } from "../lib/api-error.js";
import { validateBody } from "../middleware/validate.js";

// Mounted only after requireAuth and requireAdmin. Never expose credentials.
const router = Router();
const projection = "name email countryCode avatarUrl role preferences wallet coins referralCode referredBy createdAt updatedAt lastLoginAt";
const integer = z.number().int().min(0).max(1_000_000_000);
export const editableUserProfile = z.object({
  name: z.string().trim().min(1).max(80), email: z.string().email().max(254).transform(v=>v.toLowerCase()),
  countryCode: z.string().regex(/^[A-Z]{2}$/).optional(), avatarUrl: z.string().max(14000000).optional(),
  preferences: z.object({ language: z.enum(["ru","uz","en"]), theme: z.enum(["light","dark","auto"]), savingsGoalCents: integer, notificationsEnabled: z.boolean(), dailyReminderEnabled: z.boolean(), timezone: z.string().max(80).refine(v=>{try{new Intl.DateTimeFormat("en",{timeZone:v});return true;}catch{return false;}}) }).strict(),
  wallet: z.object({ availableUnits: integer }).strict(), coins: z.object({ balance: integer }).strict(),
}).strict();
function id(value: string) {if(!/^[a-f0-9]{24}$/i.test(value))throw new ApiError(400,"invalid_user","Некорректный пользователь.");return new mongoose.Types.ObjectId(value);}
router.get("/",async(req,res)=>{
 const q=String(req.query.q??"").trim().slice(0,100),page=Math.max(0,Math.min(100000,Number(req.query.page)||0));
 const escaped=q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
 const filter=q?{$or:[{name:{$regex:escaped,$options:"i"}},{email:{$regex:escaped,$options:"i"}},{referralCode:{$regex:escaped,$options:"i"}}]}:{};
 const [users,total]=await Promise.all([User.find(filter).select(projection).sort({_id:1}).skip(Math.floor(page)*25).limit(25).lean(),User.countDocuments(filter)]);
 res.json({data:{users,total}});
});
router.patch("/:id",validateBody(z.object({expectedUpdatedAt:z.string().datetime(),reason:z.string().trim().min(3).max(240),profile:editableUserProfile}).strict()),async(req,res)=>{
 const userId=id(String(req.params.id)),session=await mongoose.startSession();let result;
 try{await session.withTransaction(async()=>{
  const old=await User.findById(userId).select(projection).session(session).lean();if(!old)throw new ApiError(404,"not_found","Пользователь не найден.");
  if(new Date(old.updatedAt).toISOString()!==req.body.expectedUpdatedAt)throw new ApiError(409,"changed","Данные изменились. Обновите список.");
  const p=req.body.profile;const fields={name:p.name,email:p.email,...(p.countryCode?{countryCode:p.countryCode}:{}),...(p.avatarUrl!==undefined?{avatarUrl:p.avatarUrl}:{}),preferences:p.preferences,"wallet.availableUnits":p.wallet.availableUnits,"coins.balance":p.coins.balance};
  result=await User.findOneAndUpdate({_id:userId,updatedAt:old.updatedAt},{$set:fields},{new:true,runValidators:true,session}).select(projection).lean();if(!result)throw new ApiError(409,"changed","Обновите список.");
  await mongoose.connection.db!.collection("adminuseraudits").insertOne({operationId:randomUUID(),adminId:req.auth!.userId,action:"edit_user",reason:req.body.reason,before:old,after:result,createdAt:new Date()},{session});
 });}finally{await session.endSession();}res.json({data:{user:result}});
});
router.post("/reset-balances",validateBody(z.object({kind:z.enum(["money","coins"]),confirmation:z.string(),reason:z.string().trim().min(3).max(240),operationId:z.string().uuid()}).strict()),async(req,res)=>{
 const {kind,confirmation,reason,operationId}=req.body;
 if(confirmation!==`RESET ALL ${kind.toUpperCase()}`)throw new ApiError(400,"confirmation_required","Введите точную фразу подтверждения.");
 const session=await mongoose.startSession();let count=0;
 try{await session.withTransaction(async()=>{
  const audits=mongoose.connection.db!.collection("adminuseraudits");
  if(await audits.findOne({operationId,action:"reset_complete"},{session}))throw new ApiError(409,"already_applied","Операция уже выполнена.");
  // Reserved withdrawal money is deliberately not reset or refunded.
  const field=kind==="money"?"wallet.availableUnits":"coins.balance";
  const users=await User.find({[field]:{$gt:0}}).select("wallet coins name").session(session).lean();
  for(const user of users){await audits.insertOne({operationId,adminId:req.auth!.userId,userId:user._id,action:`reset_${kind}`,reason,before:{wallet:user.wallet,coins:user.coins},createdAt:new Date()},{session});
   const changed=await User.updateOne({_id:user._id,[field]:kind==="money"?user.wallet.availableUnits:user.coins.balance},{$set:{[field]:0}},{session});if(changed.modifiedCount!==1)throw new ApiError(409,"changed","Баланс изменился. Повторите операцию.");count++;}
  await audits.insertOne({operationId,action:"reset_complete",adminId:req.auth!.userId,kind,count,reason,createdAt:new Date()},{session});
 });}finally{await session.endSession();}res.json({data:{count}});
});
export default router;
