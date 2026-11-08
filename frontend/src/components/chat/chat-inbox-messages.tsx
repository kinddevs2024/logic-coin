import {useAppStore} from "@/store/app-store";
import {useQuery} from "@tanstack/react-query";
import {router} from "expo-router";
import {ActivityIndicator,FlatList,Pressable,View} from "react-native";
import {Avatar} from "@/components/avatar";
import {AppText} from "@/components/app-text";
import {LogoMark} from "@/components/logo";
import {GlassSurface} from "@/components/glass-surface";
import {useAppTheme} from "@/hooks/use-app-theme";
import {chatApi} from "@/lib/chat-api";
import {useChatCopy} from "@/lib/chat-copy";
export function ChatInboxMessages({token,onClose}:{token:string|null;onClose:()=>void}) {
 const theme=useAppTheme(),c=useChatCopy(),accountId=useAppStore(state=>state.user.id);
 const query=useQuery({queryKey:["chat-list",token],queryFn:()=>chatApi.list(token!),enabled:Boolean(token),staleTime:15000});
 const rooms=(query.data?.chats??[]).filter(room=>Boolean(room.incoming?.senderId && room.incoming.senderId !== accountId)).sort((a,b)=>b.incoming!.at.localeCompare(a.incoming!.at));
 if(query.isPending)return <ActivityIndicator color={String(theme.primary)}/>;
 return <FlatList showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} data={rooms} keyExtractor={room=>room.id} contentContainerStyle={{gap:12,paddingBottom:12}} ListEmptyComponent={<AppText muted style={{padding:20}}>{c.empty}</AppText>} renderItem={({item:room})=><Pressable accessibilityRole="button" onPress={()=>{onClose();router.push({pathname:"/messages",params:{chat:room.id}});}}>
  <GlassSurface variant="strong" style={{padding:16,borderRadius:24,flexDirection:"row",gap:12,alignItems:"center"}}>
   {room.isOfficial?<LogoMark size={42}/>:<Avatar userId={room.peer?.id ?? room.id} name={room.peer?.username||room.title} avatarUrl={room.peer?.avatarUrl} size={42}/>}
   <View style={{flex:1,gap:5}}><AppText variant="label">{room.systemKey==="news"?c.news:room.systemKey==="community"?c.community:room.kind==="support"&&room.isOfficial?c.support:room.title}</AppText><AppText muted numberOfLines={2}>{room.incoming?.preview||(room.incoming?.hasAttachment?c.attach:c.empty)}</AppText></View>
   {room.unread>0?<View style={{backgroundColor:theme.primary,borderRadius:12,padding:5,minWidth:24,alignItems:"center"}}><AppText color={String(theme.onPrimary)} variant="caption">{room.unread}</AppText></View>:null}
  </GlassSurface>
 </Pressable>}/>;
}
