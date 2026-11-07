import {createCipheriv,createDecipheriv,randomBytes} from "node:crypto";
import {readFileSync} from "node:fs";
import {env} from "../config/env.js";
import {ApiError} from "./api-error.js";
let cached:Buffer|undefined;
function key(){
 if(cached)return cached;
 try{const value=Buffer.from(readFileSync(env.WITHDRAWAL_CARD_KEY_FILE,"utf8").trim(),"base64");if(value.length!==32)throw Error();cached=value;return value;}catch{throw new ApiError(503,"payout_details_unavailable","Сохранение реквизитов временно недоступно. Повторите позже.");}
}
export function validPayoutCard(value:string){
 if(!/^\d{16,19}$/.test(value))return false;
 let sum=0,double=false;for(let i=value.length-1;i>=0;i--){let n=Number(value[i]);if(double){n*=2;if(n>9)n-=9;}sum+=n;double=!double;}return sum%10===0;
}
export function encryptPayoutCard(number:string,context:string,secret=key()){
 if(!validPayoutCard(number))throw new ApiError(400,"invalid_card_number","Проверьте номер карты.");
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",secret,iv);cipher.setAAD(Buffer.from(context));
 const encrypted=Buffer.concat([cipher.update(number,"utf8"),cipher.final()]);return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function decryptPayoutCard(value:string,context:string,secret=key()){
 try{const [version,iv,tag,data]=value.split('.');if(version!=='v1'||!iv||!tag||!data)throw Error();const cipher=createDecipheriv('aes-256-gcm',secret,Buffer.from(iv,'base64url'));cipher.setAAD(Buffer.from(context));cipher.setAuthTag(Buffer.from(tag,'base64url'));const number=Buffer.concat([cipher.update(Buffer.from(data,'base64url')),cipher.final()]).toString('utf8');if(!validPayoutCard(number))throw Error();return number;}catch{throw new ApiError(503,'payout_details_unavailable','Не удалось открыть реквизиты карты. Требуется проверка администратора.');}
}
