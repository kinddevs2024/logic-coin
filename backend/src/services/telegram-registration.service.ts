import {env} from "../config/env.js";
import {ApiError} from "../lib/api-error.js";
import {TelegramContact} from "../models/TelegramContact.js";
import {TelegramLoginChallenge} from "../models/TelegramLoginChallenge.js";
import {User} from "../models/User.js";
export const REGISTRATION_CHANNEL="@logic_coin_global";
type Person={id?:number|string;first_name?:string;last_name?:string;username?:string;language_code?:string};
export type RegistrationUpdate={message?:{chat?:{id?:number|string;type?:string};from?:Person;contact?:{user_id?:number;phone_number?:string};text?:string};callback_query?:{id?:string;data?:string;from?:Person;message?:{chat?:{id?:number|string;type?:string}}}};
type Identity={id:string;firstName:string;lastName?:string;username?:string};
const copy={
 ru:{intro:"👋 Чтобы зарегистрироваться в Logic Coin, поделитесь своим номером телефона кнопкой ниже. Он нужен администрации для связи и выдачи призов; другим игрокам номер не показывается.",contact:"📱 Поделиться своим контактом",subscribe:"📣 Подпишитесь на официальный канал, затем нажмите «Проверить подписку».",channel:"📣 Открыть канал",check:"✅ Проверить подписку",retry:"Пока не вижу подписку. Подпишитесь на канал и попробуйте ещё раз.",wrong:"Нужен именно ваш контакт: нажмите кнопку «Поделиться своим контактом».",unavailable:"Не удалось проверить подписку. Попробуйте ещё раз немного позже."},
 uz:{intro:"👋 Logic Coin’da ro‘yxatdan o‘tish uchun quyidagi tugma orqali o‘z telefon raqamingizni yuboring. Raqam sovrinlarni topshirish va bog‘lanish uchun ma’muriyatga kerak; boshqa o‘yinchilarga ko‘rsatilmaydi.",contact:"📱 O‘z kontaktimni yuborish",subscribe:"📣 Rasmiy kanalga obuna bo‘ling, so‘ng «Obunani tekshirish» tugmasini bosing.",channel:"📣 Kanalni ochish",check:"✅ Obunani tekshirish",retry:"Obuna hali topilmadi. Kanalga obuna bo‘lib, qayta tekshiring.",wrong:"Faqat o‘z kontaktingizni tugma orqali yuboring.",unavailable:"Obunani tekshirib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring."},
 en:{intro:"👋 To register with Logic Coin, share your own phone number using the button below. Administrators use it to contact you and deliver prizes; other players cannot see it.",contact:"📱 Share my contact",subscribe:"📣 Subscribe to our official channel, then tap ‘Check subscription’.",channel:"📣 Open channel",check:"✅ Check subscription",retry:"Your subscription was not found yet. Join the channel and try again.",wrong:"Please share your own contact using the contact button.",unavailable:"Could not verify your subscription. Please try again shortly."}
};
const lang=(l?:string)=>l?.startsWith("uz")?"uz":l?.startsWith("en")?"en":"ru";
async function bot(method:string,data:unknown){
 if(!env.TELEGRAM_BOT_TOKEN)throw new ApiError(503,"telegram_unavailable","Telegram is unavailable");
 const response=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data),signal:AbortSignal.timeout(8000)});
 const body=await response.json() as {ok?:boolean;result?:any};
 if(!response.ok||!body.ok)throw new ApiError(503,"telegram_unavailable","Telegram is unavailable");
 return body.result;
}
export async function verifyRegistrationMembership(id:string){
 const result=await bot("getChatMember",{chat_id:REGISTRATION_CHANNEL,user_id:id});
 return ["creator","administrator","member"].includes(result?.status)||(result?.status==="restricted"&&result.is_member===true);
}
export function ownTelegramContact(message:NonNullable<RegistrationUpdate["message"]>){
 const id=String(message.from?.id??"");
 if(message.chat?.type!=="private"||String(message.chat.id)!==id||String(message.contact?.user_id)!==id)return null;
 const phone=message.contact?.phone_number?.replace(/[\s()-]/g,"");
 return phone&&/^\+?\d{5,20}$/.test(phone)?phone:null;
}
async function recordIdentity(identity:Identity,chatId:string,language:string){
 if(chatId!==identity.id)return;
 await TelegramContact.updateOne({telegramId:identity.id},{$set:{chatId,firstName:identity.firstName,lastName:identity.lastName??"",username:identity.username??"",language,lastInteractionAt:new Date()},$setOnInsert:{botStartedAt:new Date()}},{upsert:true});
}
async function prompt(chatId:string,language:string,contact:boolean,flowId?:string,reason?:string){
 const c=copy[lang(language)];
 if(contact){await bot("sendMessage",{chat_id:chatId,text:reason??c.intro,reply_markup:{keyboard:[[{text:c.contact,request_contact:true}]],resize_keyboard:true,one_time_keyboard:true}});return;}
 // Clear the contact keyboard before showing channel actions.
 await bot("sendMessage",{chat_id:chatId,text:reason??c.subscribe,reply_markup:{remove_keyboard:true}});
 await bot("sendMessage",{chat_id:chatId,text:c.subscribe,reply_markup:{inline_keyboard:[[{text:c.channel,url:"https://t.me/logic_coin_global"}],[{text:c.check,callback_data:`lc_reg${flowId?":"+flowId:""}`}]]}});
}
export async function prepareTelegramRegistration(identity:Identity,chatId:string,language:string,flowId?:string){
 if(!env.TELEGRAM_REGISTRATION_REQUIREMENTS)return true;
 if(await User.exists({"providers.telegramSub":identity.id}))return true;
 if(chatId!==identity.id)return false;
 await recordIdentity(identity,chatId,language);
 if(flowId){
  const bound=await TelegramLoginChallenge.findOneAndUpdate({flowId,confirmedAt:{$exists:false},expiresAt:{$gt:new Date()},$or:[{telegramUser:{$exists:false}},{"telegramUser.id":identity.id}]},{$set:{telegramUser:identity}},{new:true});
  if(!bound)return false;
 }
 const contact=await TelegramContact.findOne({telegramId:identity.id}).select("+phoneNumber");
 if(!contact?.phoneNumber||!contact.phoneVerifiedAt){await prompt(chatId,language,true,flowId);return false;}
 let member=false;
 try{member=await verifyRegistrationMembership(identity.id);}catch{await prompt(chatId,language,false,flowId,copy[lang(language)].unavailable);return false;}
 if(!member){await prompt(chatId,language,false,flowId);return false;}
 await TelegramContact.updateOne({telegramId:identity.id},{$set:{subscriptionCheckedAt:new Date()}});
 return true;
}
export async function assertTelegramRegistration(identity:Identity){
 if(!env.TELEGRAM_REGISTRATION_REQUIREMENTS)return;
 const c=await TelegramContact.findOne({telegramId:identity.id}).select("+phoneNumber");
 if(!c?.phoneNumber||!c.phoneVerifiedAt)throw new ApiError(409,"telegram_contact_required","Откройте Telegram-бота Logic Coin и поделитесь своим контактом, чтобы завершить регистрацию.");
 if(!await verifyRegistrationMembership(identity.id))throw new ApiError(409,"telegram_subscription_required","Подпишитесь на @logic_coin_global и проверьте подписку в боте.");
 await TelegramContact.updateOne({telegramId:identity.id},{$set:{subscriptionCheckedAt:new Date()}});
}
export async function handleRegistrationUpdate(update:RegistrationUpdate,complete:(identity:Identity,chatId:string,flowId?:string)=>Promise<void>){
 const callback=update.callback_query;
 const isCallback=Boolean(callback?.data?.match(/^lc_reg(?::[A-Za-z0-9_-]{20,30})?$/));
 if(!update.message?.contact&&!isCallback)return false;
 const person=isCallback?callback?.from:update.message?.from,chat=isCallback?callback?.message?.chat:update.message?.chat;
 const id=String(person?.id??"");if(!id||chat?.type!=="private"||String(chat.id)!==id)return true;
 const language=lang(person?.language_code),identity={id,firstName:person?.first_name??"Logic member",...(person?.last_name?{lastName:person.last_name}:{}),...(person?.username?{username:person.username}:{})};
 if(isCallback&&callback?.id)await bot("answerCallbackQuery",{callback_query_id:callback.id}).catch(()=>undefined);
 await recordIdentity(identity,id,language);
 if(update.message?.contact){
  const phone=ownTelegramContact(update.message);
  if(!phone){await prompt(id,language,true,undefined,copy[language].wrong);return true;}
  await TelegramContact.updateOne({telegramId:id},{$set:{phoneNumber:phone,phoneVerifiedAt:new Date()}});
 }
 const requested=callback?.data?.split(":")[1];
 const flow=await TelegramLoginChallenge.findOne({...(requested?{flowId:requested}:{}),"telegramUser.id":id,confirmedAt:{$exists:false},expiresAt:{$gt:new Date()}}).sort({createdAt:-1});
 if(requested&&!flow)return true;
 if(await prepareTelegramRegistration(identity,id,flow?.language??language,flow?.flowId))await complete(identity,id,flow?.flowId);
 return true;
}
