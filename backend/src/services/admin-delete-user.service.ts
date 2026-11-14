import mongoose, {Types} from 'mongoose';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {unlink} from 'node:fs/promises';
import {ApiError} from '../lib/api-error.js';
import {User} from '../models/User.js';
import {AccountBan} from '../models/AccountBan.js';

const ownedData=['gameprogresses','rewardedadsessions','refreshsessions','homegiftstates','giftitems','challengeattempts','notificationreads','activitydays','challengeadrewards','chatmembers','devices','coinrewardlogins','useravatars','rafflewinnerreplies','rafflepresences','passwordsetupchallenges','taskclaims','bonusclaims','rafflewinnotices'];
const mediaRoot=path.resolve(process.env.CHAT_MEDIA_DIR||(process.env.NODE_ENV==='production'?'/srv/apps/logic-coin/shared/chat-media':'.chat-media'));

/** Deletes a profile while keeping financial totals under a fresh anonymous identifier. */
export async function deleteAdminUser(userId:Types.ObjectId,adminId:Types.ObjectId,reason:string){
 if(String(userId)===String(adminId))throw new ApiError(400,'self_delete','Нельзя удалить себя');
 const session=await mongoose.startSession();let jobs:{id:Types.ObjectId;key:string}[]=[];
 try{await session.withTransaction(async()=>{
  const db=mongoose.connection.db!;
  await db.collection<{_id:string;revision:number}>('platformrolelocks').updateOne({_id:'roles'},{$inc:{revision:1}},{upsert:true,session});
  const user=await User.findById(userId).session(session).lean();if(!user)throw new ApiError(404,'not_found','Пользователь не найден');
  const bannedAdmins=await AccountBan.distinct('userId',{active:true}).session(session);
  if(user.role==='admin'&&!bannedAdmins.some(id=>String(id)===String(userId))&&await User.countDocuments({role:'admin',_id:{$nin:bannedAdmins}}).session(session)<=1)throw new ApiError(409,'last_admin','Нельзя удалить последнего администратора');
  const rooms=await db.collection('chatconversations').find({directKey:{$regex:String(userId)}},{session,projection:{_id:1,kind:1}}).toArray();
  if(rooms.some(x=>x.kind!=='direct'&&x.kind!=='support'))throw new ApiError(409,'dependent_data','Проверьте связанные чаты');
  const roomIds=rooms.map(x=>x._id),affected=await db.collection('chatmessages').distinct('conversationId',{senderId:userId},{session});
  const attached=await db.collection('chatattachments').find({ownerId:userId},{session,projection:{_id:1,storageKey:1}}).toArray();
  if(attached.some(x=>typeof x.storageKey!=='string'||!/^[a-f0-9]{48}$/.test(x.storageKey)))throw new ApiError(409,'invalid_attachment','Не удалось безопасно обработать файлы пользователя');
  jobs=attached.map(x=>({id:new Types.ObjectId(),key:String(x.storageKey)}));
  if(jobs.length)await db.collection('deletedmediajobs').insertMany(jobs.map(j=>({_id:j.id,storageKey:j.key,createdAt:new Date()})),{session});
  const attachmentIds=attached.map(x=>x._id);
  if(attachmentIds.length){
   await db.collection('chatmessages').updateMany({attachmentIds:{$in:attachmentIds}},{$pull:{attachmentIds:{$in:attachmentIds}} as never},{session});
   await db.collection('chatconversations').updateMany({avatarAttachmentId:{$in:attachmentIds}},{$unset:{avatarAttachmentId:''}},{session});
   await db.collection('chatmembers').updateMany({wallpaperAttachmentId:{$in:attachmentIds}},{$unset:{wallpaperAttachmentId:''}},{session});
   await db.collection('chatattachments').deleteMany({_id:{$in:attachmentIds}},{session});
  }
  const owned=await db.collection('chatconversations').find({ownerId:userId},{session,projection:{_id:1}}).toArray();
  for(const room of owned){await db.collection('chatconversations').updateOne({_id:room._id},{$set:{ownerId:adminId}},{session});await db.collection('chatmembers').updateOne({conversationId:room._id,userId:adminId},{$set:{role:'owner'},$unset:{leftAt:''},$setOnInsert:{conversationId:room._id,userId:adminId,muted:false}},{upsert:true,session})}
  await User.updateMany({referredBy:userId},{$unset:{referredBy:1}},{session});
  for(const name of ownedData)await db.collection(name).deleteMany({userId},{session});
  const anon=new Types.ObjectId();
  for(const name of ['ledgerentries','coinledgerentries','dailycontestresults'])await db.collection(name).updateMany({userId},{$set:{userId:anon}},{session});
  // Keep totals, but remove payment identifiers; unresolved requests can no longer be paid after deletion.
  await db.collection('withdrawals').updateMany({userId},{$set:{userId:anon},$unset:{accountLabel:'',cardNumberEncrypted:'',cardLast4:'',cardHolder:'',cardExpiration:'',reviewNote:'',reviewHistory:''}},{session});
  await db.collection('withdrawals').updateMany({userId:anon,status:{$in:['pending_review','approved','sandbox_pending']}},{$set:{status:'rejected',reviewedAt:new Date(),reviewedBy:adminId,reviewNote:'Account deleted by administrator'},$inc:{reviewVersion:1}},{session});
  await db.collection('devicesecurities').updateMany({accountIds:userId},{$pull:{accountIds:userId,registeredAccountIds:userId} as never},{session});
  await db.collection('chatblocks').deleteMany({$or:[{userId},{blockedId:userId}]},{session});
  await db.collection('chatfriendships').deleteMany({$or:[{requesterId:userId},{recipientId:userId}]},{session});
  await db.collection('chatcomments').deleteMany({senderId:userId},{session});
  await db.collection('chatmessages').deleteMany({$or:[{senderId:userId},...(roomIds.length?[{conversationId:{$in:roomIds}}]:[])]},{session});
  if(roomIds.length){await db.collection('chatmembers').deleteMany({conversationId:{$in:roomIds}},{session});await db.collection('chatconversations').deleteMany({_id:{$in:roomIds}},{session})}
  for(const cid of affected.filter(x=>!roomIds.some(y=>y.equals(x)))){const last=await db.collection('chatmessages').find({conversationId:cid,deletedAt:{$exists:false}},{session}).sort({seq:-1}).limit(1).next();await db.collection('chatconversations').updateOne({_id:cid},{$set:{lastMessageSeq:last?.seq??0,...(last?{lastMessageAt:last.createdAt}:{})}},{session})}
  if(user.providers?.telegramSub)await db.collection('telegramcontacts').deleteOne({telegramId:user.providers.telegramSub},{session});
  await db.collection('notificationevents').updateMany({'payload.userIds':String(userId)},{$pull:{'payload.userIds':String(userId)} as never},{session});
  // Keep active device/IP bans after account deletion, without retaining the former account identifier.
  await AccountBan.updateOne({userId,active:true},{$set:{userId:anon}},{session});await AccountBan.deleteMany({userId,active:false},{session});
  const removed=await User.deleteOne({_id:userId},{session});if(removed.deletedCount!==1)throw new ApiError(409,'changed','Пользователь изменился');
  await db.collection('adminuseraudits').insertOne({operationId:randomUUID(),adminId,userId,action:'delete_user',reason,balancesBefore:user.wallet,retainedAnonymizedFinancialRecords:true,createdAt:new Date()},{session});
 });}finally{await session.endSession()}
 let pendingMedia=0;for(const job of jobs){try{await unlink(path.join(mediaRoot,job.key)).catch((error:NodeJS.ErrnoException)=>{if(error.code!=='ENOENT')throw error});await mongoose.connection.db!.collection('deletedmediajobs').deleteOne({_id:job.id})}catch{pendingMedia++}}
 return {deleted:true,pendingMedia};
}

/** Retry file removal if an earlier attempt failed after the database transaction. */
export function startDeletedMediaWorker(){
 let running=false;
 const run=async()=>{if(running||!mongoose.connection.db)return;running=true;try{const db=mongoose.connection.db;const jobs=await db.collection('deletedmediajobs').find({}).limit(50).toArray();for(const job of jobs){if(typeof job.storageKey!=='string'||!/^[a-f0-9]{48}$/.test(job.storageKey))continue;try{await unlink(path.join(mediaRoot,job.storageKey)).catch((error:NodeJS.ErrnoException)=>{if(error.code!=='ENOENT')throw error});await db.collection('deletedmediajobs').deleteOne({_id:job._id})}catch{/* Retain the durable job for a later retry. */}}}finally{running=false}};
 const timer=setInterval(()=>{void run().catch(()=>{})},60_000);void run().catch(()=>{});return()=>clearInterval(timer);
}
