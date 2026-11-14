import {Schema,model,models,type InferSchemaType,type Model} from 'mongoose';
const schema=new Schema({userId:{type:Schema.Types.ObjectId,ref:'User',required:true,unique:true},deviceIds:[{type:String,maxlength:160}],ips:[{type:String,maxlength:100}],reason:{type:String,required:true,maxlength:240},adminId:{type:Schema.Types.ObjectId,ref:'User',required:true},active:{type:Boolean,default:true,required:true}},{timestamps:true,versionKey:false});
schema.index({active:1,deviceIds:1});schema.index({active:1,ips:1});
type Ban=InferSchemaType<typeof schema>;export const AccountBan=(models.AccountBan as Model<Ban>|undefined)??model<Ban>('AccountBan',schema);
