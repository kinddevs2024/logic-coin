import { normalizeUsername } from "../lib/chat-policy.js";
import {TelegramContact} from "../models/TelegramContact.js";
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { THEMES, SUPPORTED_LANGUAGES, USER_ROLES } from "../config/constants.js";
import { User } from "../models/User.js";
import { ApiError } from "../lib/api-error.js";
import { validateBody } from "../middleware/validate.js";

// Mounted only after requireAuth and requireAdmin. Never expose credentials.
const router = Router();
const projection = "name username email countryCode avatarUrl role preferences wallet coins referralCode referredBy createdAt updatedAt lastLoginAt";
const integer = z.number().int().min(0).max(1_000_000_000);
export const editableUserProfile = z.object({
  username: z.union([z.string().max(100).refine(value => !value.trim() || normalizeUsername(value) !== null, "Никнейм: 4–24 латинских буквы, цифры или _, начинается с буквы; служебные имена недоступны.").transform(value => value.trim() ? normalizeUsername(value)! : null), z.null()]).optional(),
  name: z.string().trim().min(1).max(80), email: z.string().email().max(254).transform(v=>v.toLowerCase()),
  countryCode: z.string().regex(/^[A-Z]{2}$/).optional(), avatarUrl: z.string().max(14000000).optional(),
  preferences: z.object({ language: z.enum(SUPPORTED_LANGUAGES), theme: z.enum(THEMES), customTheme: z.object({ wallpaperUrl: z.string().min(1).max(2048), accent: z.string().regex(/^#[0-9a-f]{6}$/i), dark: z.boolean() }).strict().optional(), savingsGoalCents: integer, notificationsEnabled: z.boolean(), dailyReminderEnabled: z.boolean(), timezone: z.string().max(80).refine(v=>{try{new Intl.DateTimeFormat("en",{timeZone:v});return true;}catch{return false;}}) }).strict(),
  wallet: z.object({ availableUnits: z.number().min(0).max(1_000_000_000) }).strict(), coins: z.object({ balance: integer }).strict(),
}).strict();
function id(value: string) {if(!/^[a-f0-9]{24}$/i.test(value))throw new ApiError(400,"invalid_user","Некорректный пользователь.");return new mongoose.Types.ObjectId(value);}
router.get("/:id/telegram-contact",async(req,res)=>{
 const user=await User.findById(id(String(req.params.id))).select("providers.telegramSub").lean();
 if(!user)throw new ApiError(404,"not_found","Пользователь не найден.");
 const contact=user.providers?.telegramSub?await TelegramContact.findOne({telegramId:user.providers.telegramSub}).select("+phoneNumber -__v").lean():null;
 res.json({data:{contact}});
});
router.get("/",async(req,res)=>{
 const q=String(req.query.q??"").trim().slice(0,100),page=Math.max(0,Math.min(100000,Number(req.query.page)||0));
 const escaped=q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
 const filter=q?{$or:[{name:{$regex:escaped,$options:"i"}},{email:{$regex:escaped,$options:"i"}},{username:{$regex:escaped.replace(/^@/,""),$options:"i"}},{referralCode:{$regex:escaped,$options:"i"}}]}:{};
 const [users,total]=await Promise.all([User.find(filter).select(projection).sort({_id:1}).skip(Math.floor(page)*25).limit(25).lean(),User.countDocuments(filter)]);
 res.json({data:{users,total}});
});
router.patch("/:id/role", validateBody(z.object({role:z.enum(USER_ROLES), expectedRole:z.enum(USER_ROLES), reason:z.string().trim().min(3).max(240)}).strict()), async(req,res)=>{
 const userId=id(String(req.params.id)), session=await mongoose.startSession();let result;
 try { await session.withTransaction(async()=>{
  await mongoose.connection.db!.collection<{_id:string; revision:number}>("platformrolelocks").updateOne({_id:"roles"},{$inc:{revision:1}},{upsert:true,session});
  const actor=await User.findById(req.auth!.userId).select("role").session(session).lean();
  if(actor?.role!=="admin")throw new ApiError(403,"admin_required","Administrator access is required");
  const target=await User.findById(userId).select("role").session(session).lean();
  if(!target)throw new ApiError(404,"not_found","Пользователь не найден.");
  if(target.role!==req.body.expectedRole)throw new ApiError(409,"changed","Роль уже изменена. Обновите список.");
  if(String(userId)===String(req.auth!.userId)&&req.body.role!=="admin")throw new ApiError(400,"self_demotion","Изменить вашу роль должен другой администратор.");
  if(target.role==="admin"&&req.body.role!=="admin"&&await User.countDocuments({role:"admin"}).session(session)<=1)throw new ApiError(409,"last_admin","Нельзя удалить последнего администратора.");
  result=await User.findByIdAndUpdate(userId,{$set:{role:req.body.role}},{new:true,runValidators:true,session}).select(projection).lean();
  await mongoose.connection.db!.collection("adminuseraudits").insertOne({operationId:randomUUID(),adminId:req.auth!.userId,userId,action:"change_role",before:target.role,after:req.body.role,reason:req.body.reason,createdAt:new Date()},{session});
 });}finally{await session.endSession();}
 res.json({data:{user:result}});
});
router.patch("/:id",validateBody(z.object({expectedUpdatedAt:z.string().datetime(),reason:z.string().trim().min(3).max(240),profile:editableUserProfile}).strict()),async(req,res)=>{
 const userId=id(String(req.params.id)),session=await mongoose.startSession();let result;
 try{await session.withTransaction(async()=>{
  const old=await User.findById(userId).select(projection).session(session).lean();if(!old)throw new ApiError(404,"not_found","Пользователь не найден.");
  if(new Date(old.updatedAt).toISOString()!==req.body.expectedUpdatedAt)throw new ApiError(409,"changed","Данные изменились. Обновите список.");
  const p=req.body.profile;const fields={...(p.username != null ? {username:p.username}:{}),name:p.name,email:p.email,...(p.countryCode?{countryCode:p.countryCode}:{}),...(p.avatarUrl!==undefined?{avatarUrl:p.avatarUrl}:{}),...Object.fromEntries(Object.entries(p.preferences).map(([key,value])=>[`preferences.${key}`,value])),"wallet.availableUnits":p.wallet.availableUnits,"coins.balance":p.coins.balance};
  result=await User.findOneAndUpdate({_id:userId,updatedAt:old.updatedAt},{$set:fields,...(p.username===null?{$unset:{username:1}}:{})},{new:true,runValidators:true,session}).select(projection).lean();if(!result)throw new ApiError(409,"changed","Обновите список.");
  await mongoose.connection.db!.collection("adminuseraudits").insertOne({operationId:randomUUID(),adminId:req.auth!.userId,action:"edit_user",reason:req.body.reason,before:old,after:result,createdAt:new Date()},{session});
 });}catch(error){
  const duplicate=error as {code?:number;keyPattern?:Record<string,unknown>;keyValue?:Record<string,unknown>};
  if(duplicate.code===11000&&(duplicate.keyPattern?.username||duplicate.keyValue?.username))throw new ApiError(409,"username_taken","Этот никнейм уже занят. Выберите другой.");
  throw error;
 }finally{await session.endSession();}res.json({data:{user:result}});
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
