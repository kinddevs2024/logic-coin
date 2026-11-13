import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
const schema = new Schema({
  conversationId:{type:Schema.Types.ObjectId,required:true}, messageId:{type:Schema.Types.ObjectId,ref:"ChatMessage",required:true},
  senderId:{type:Schema.Types.ObjectId,ref:"User",required:true},clientId:{type:String,required:true,maxlength:100},
  text:{type:String,required:true,maxlength:4000},replyTo:{type:Schema.Types.ObjectId,ref:"ChatComment"},deletedAt:Date,
},{timestamps:true,versionKey:false});
schema.index({messageId:1,senderId:1,clientId:1},{unique:true});schema.index({messageId:1,_id:-1});
type Row=InferSchemaType<typeof schema>;
export const ChatComment=(models.ChatComment as Model<Row>|undefined)??model<Row>("ChatComment",schema);
