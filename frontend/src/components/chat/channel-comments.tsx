import {useEffect,useRef,useState} from "react";
import {useInfiniteQuery,useMutation} from "@tanstack/react-query";
import {ActivityIndicator,Pressable,ScrollView,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {AppText} from "@/components/app-text";
import {AppButton} from "@/components/buttons";
import {Avatar} from "@/components/avatar";
import {useAppTheme} from "@/hooks/use-app-theme";
import {useAppStore} from "@/store/app-store";
import {chatApi,type ChatItem,type ChatRoom,type ChatCommentItem} from "@/lib/chat-api";
import {ChatSheet} from "./chat-sheet";
const copies={ru:{title:"Комментарии",empty:"Комментариев пока нет",write:"Написать комментарий…",send:"Отправить",reply:"Ответить",cancel:"Отмена",remove:"Удалить",deleted:"Комментарий удалён",older:"Предыдущие комментарии",retry:"Повторить",profile:"Открыть профиль"},uz:{title:"Izohlar",empty:"Hali izoh yo‘q",write:"Izoh yozish…",send:"Yuborish",reply:"Javob berish",cancel:"Bekor qilish",remove:"O‘chirish",deleted:"Izoh o‘chirilgan",older:"Oldingi izohlar",retry:"Qayta urinish",profile:"Profilni ochish"},en:{title:"Comments",empty:"No comments yet",write:"Write a comment…",send:"Send",reply:"Reply",cancel:"Cancel",remove:"Delete",deleted:"Comment deleted",older:"Older comments",retry:"Retry",profile:"Open profile"}};
export function ChannelComments({room,item,token,onClose,onProfile,onChanged}:{room:ChatRoom;item:ChatItem;token:string;onClose:()=>void;onProfile:(id:string)=>void;onChanged:()=>void}){
 const theme=useAppTheme(),language=useAppStore(s=>s.language)??"uz",c=copies[language];
 const [text,setText]=useState(""),[reply,setReply]=useState<ChatCommentItem|null>(null),[error,setError]=useState("");const operation=useRef<string|null>(null);const input=useRef<TextInput>(null);
 const query=useInfiniteQuery({queryKey:["chat-comments",token,room.id,item.id],queryFn:({pageParam})=>chatApi.comments(token,room.id,item.id,pageParam),initialPageParam:undefined as string|undefined,getNextPageParam:last=>last.before??undefined,refetchInterval:5000});
 const rows=[...(query.data?.pages??[])].reverse().flatMap(p=>p.items);const bottom=useRef<ScrollView>(null),atBottom=useRef(true);
 const send=useMutation({mutationFn:(draft:{clientId:string;text:string;replyTo?:string})=>chatApi.comment(token,room.id,item.id,draft),onSuccess:()=>{setText("");setReply(null);operation.current=null;atBottom.current=true;void query.refetch();onChanged();},onError:e=>setError(e instanceof Error?e.message:c.retry)});
 const remove=useMutation({mutationFn:(id:string)=>chatApi.removeComment(token,room.id,item.id,id),onSuccess:()=>{void query.refetch();onChanged();},onError:e=>setError(e instanceof Error?e.message:c.retry)});
 useEffect(()=>{if(reply)input.current?.focus();},[reply]);
 return <ChatSheet title={`${c.title} · ${query.data?.pages[0]?.total??item.commentCount??0}`} onClose={onClose}>
  <View style={{gap:10,maxHeight:600,minHeight:260}}>
   <AppText muted numberOfLines={2}>{item.text}</AppText>
   <ScrollView ref={bottom} style={{maxHeight:350}} keyboardShouldPersistTaps="handled" onScroll={e=>{const n=e.nativeEvent;atBottom.current=n.contentOffset.y+n.layoutMeasurement.height>=n.contentSize.height-50;}} scrollEventThrottle={100} onContentSizeChange={()=>{if(atBottom.current)bottom.current?.scrollToEnd({animated:false});}}>
    {query.hasNextPage?<AppButton variant="ghost" loading={query.isFetchingNextPage} onPress={()=>{atBottom.current=false;void query.fetchNextPage();}}>{c.older}</AppButton>:null}
    {query.isPending?<ActivityIndicator color={String(theme.primary)}/>:null}
    {query.error?<AppButton variant="ghost" onPress={()=>{void query.refetch();}}>{c.retry}</AppButton>:null}
    {!query.isPending&&!query.error&&!rows.length?<AppText muted>{c.empty}</AppText>:null}
    {rows.map(row=><View key={row.id} testID={`comment-${row.id}`} style={{paddingVertical:10,gap:6,borderBottomWidth:1,borderColor:theme.border}}>
     <Pressable accessibilityRole="link" accessibilityLabel={`${c.profile}: ${row.sender.name}`} onPress={()=>{onClose();onProfile(row.sender.id);}} style={{flexDirection:"row",alignItems:"center",gap:8}}><Avatar userId={row.sender.id} name={row.sender.name} avatarUrl={row.sender.avatarUrl} size={28}/><AppText variant="label" color={String(theme.primary)}>{row.sender.name}</AppText></Pressable>
     {row.reply?<View style={{paddingLeft:10,borderLeftWidth:2,borderColor:theme.primary}}><Pressable accessibilityRole="link" accessibilityLabel={`${c.profile}: ${row.reply.sender.name}`} onPress={()=>{onClose();onProfile(row.reply!.sender.id);}}><AppText variant="caption" color={String(theme.primary)}>{row.reply.sender.name}</AppText></Pressable><AppText variant="caption" muted>{row.reply.deleted?c.deleted:row.reply.text}</AppText></View>:null}
     <AppText>{row.deleted?c.deleted:row.text}</AppText>
     <View style={{flexDirection:"row",gap:14,alignItems:"center",flexWrap:"wrap"}}><AppText muted variant="caption">{new Date(row.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</AppText>
      {!row.deleted?<Pressable accessibilityRole="button" onPress={()=>{operation.current=null;setReply(row);}}><AppText variant="caption" color={String(theme.primary)}>{c.reply}</AppText></Pressable>:null}
      {!row.deleted&&(row.own||room.canManage)?<Pressable accessibilityRole="button" disabled={remove.isPending} onPress={()=>{setError("");remove.mutate(row.id);}}><AppText variant="caption" color={String(theme.danger)}>{c.remove}</AppText></Pressable>:null}
     </View>
    </View>)}
   </ScrollView>
   {reply?<View style={{flexDirection:"row",gap:10,alignItems:"center"}}><AppText style={{flex:1}} numberOfLines={2}>{c.reply}: {reply.sender.name} · {reply.text}</AppText><AppButton compact variant="ghost" disabled={send.isPending} onPress={()=>{operation.current=null;setReply(null);}}>{c.cancel}</AppButton></View>:null}
   <TextInput ref={input} accessibilityLabel={c.write} placeholder={c.write} placeholderTextColor={String(theme.textMuted)} multiline maxLength={4000} value={text} editable={!send.isPending} onChangeText={value=>{operation.current=null;setText(value);setError("");}} style={{color:theme.text,borderColor:theme.border,borderWidth:1,borderRadius:12,minHeight:48,maxHeight:120,padding:12}}/>
   {error?<AppText accessibilityRole="alert" color={String(theme.danger)}>{error}</AppText>:null}
   <AppButton accessibilityLabel={c.send} loading={send.isPending} disabled={!text.trim()} onPress={()=>{if(send.isPending||!text.trim())return;setError("");operation.current??=Crypto.randomUUID();send.mutate({clientId:operation.current,text:text.trim(),...(reply?{replyTo:reply.id}:{})});}}>{c.send}</AppButton>
  </View>
 </ChatSheet>;
}
