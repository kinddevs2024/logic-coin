import {Schema,model,models,type Model,type InferSchemaType} from "mongoose";
const schema=new Schema({
 telegramId:{type:String,required:true,unique:true},chatId:{type:String,required:true},
 firstName:{type:String,maxlength:80},lastName:{type:String,maxlength:80},username:{type:String,maxlength:64},language:{type:String,maxlength:16},
 phoneNumber:{type:String,select:false,maxlength:24},phoneVerifiedAt:Date,subscriptionCheckedAt:Date,botStartedAt:Date,lastInteractionAt:Date
},{timestamps:true,versionKey:false});
type ContactDocument=InferSchemaType<typeof schema>;
export const TelegramContact=(models.TelegramContact as Model<ContactDocument>|undefined)??model<ContactDocument>("TelegramContact",schema);
