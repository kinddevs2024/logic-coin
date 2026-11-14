import {Types} from 'mongoose';
import {AccountBan} from '../models/AccountBan.js';
import {User} from '../models/User.js';
import {ApiError} from '../lib/api-error.js';
export async function isAccountAccessBlocked(userId:Types.ObjectId,context:{deviceId?:string|null|undefined;ip?:string|null|undefined}={}):Promise<boolean>{
 const user=await User.findById(userId).select('role').lean();if(!user)return true;
 // Administrators can recover from shared-address/device restrictions, but their own ban still applies.
 if(await AccountBan.exists({userId,active:true}))return true;
 if(user.role==='admin')return false;
 const predicates:Record<string,string>[]=[];if(context.deviceId?.trim())predicates.push({deviceIds:context.deviceId.trim()});if(context.ip?.trim())predicates.push({ips:context.ip.trim()});
 return !!(predicates.length&&await AccountBan.exists({active:true,$or:predicates}));
}
export async function assertAccountAccess(userId:Types.ObjectId,context:{deviceId?:string|null|undefined;ip?:string|null|undefined}={}){if(await isAccountAccessBlocked(userId,context))throw new ApiError(403,'account_banned','Account, device or network is blocked. Contact an administrator.');}
