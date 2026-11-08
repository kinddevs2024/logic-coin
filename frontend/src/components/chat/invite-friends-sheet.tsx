import {useEffect,useState} from "react";
import {useInfiniteQuery,useQueryClient} from "@tanstack/react-query";
import {useRouter} from "expo-router";
import {ActivityIndicator,Pressable,TextInput,View} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {Avatar} from "@/components/avatar";
import {AppText} from "@/components/app-text";
import {useAppTheme} from "@/hooks/use-app-theme";
import {chatApi} from "@/lib/chat-api";
import {useChatCopy} from "@/lib/chat-copy";
import {ChatAction,ChatSheet} from "./chat-sheet";
export function InviteFriendsSheet({token,onClose}:{token:string;onClose:()=>void}) {
 const theme=useAppTheme(),c=useChatCopy(),router=useRouter(),client=useQueryClient();
 const [search,setSearch]=useState(""),[term,setTerm]=useState(""),[selected,setSelected]=useState<Set<string>>(()=>new Set()),[busy,setBusy]=useState(false),[error,setError]=useState(""),[sent,setSent]=useState(0);
 useEffect(()=>{const timer=setTimeout(()=>setTerm(search.trim()),250);return()=>clearTimeout(timer);},[search]);
 const directory=useInfiniteQuery({queryKey:["chat-directory",token,term],initialPageParam:"",queryFn:({pageParam})=>chatApi.directory(token,term,pageParam),getNextPageParam:page=>page.next??undefined,staleTime:15000});
 const users=directory.data?.pages.flatMap(page=>page.users)??[];
 const send=async()=>{
  setBusy(true);setError("");let count=0;const remaining=new Set(selected);
  for(const id of selected){try{await chatApi.requestFriend(token,id);remaining.delete(id);count++;}catch(err){setError(err instanceof Error?err.message:c.error);}}
  setSelected(remaining);setSent(count);setBusy(false);
  await Promise.all([client.invalidateQueries({queryKey:["chat-directory",token]}),client.invalidateQueries({queryKey:["chat-profile",token]})]);
 };
 return <ChatSheet title={c.addFriends} onClose={onClose}>
  <ChatAction title={c.inviteLink} icon="link-outline" disabled={busy} onPress={()=>{onClose();router.push("/invite");}}/>
  <TextInput accessibilityLabel={c.searchShort} placeholder={c.searchShort} placeholderTextColor={theme.textMuted} value={search} onChangeText={setSearch} style={{padding:13,borderRadius:16,borderWidth:1,borderColor:theme.border,color:theme.text,backgroundColor:theme.surfaceRaised}}/>
  <AppText muted variant="caption">{c.friendSelectionLimit}</AppText>
  <ChatAction title={`${c.sendFriendRequests}${selected.size?` (${selected.size})`:""}`} icon="person-add-outline" disabled={busy||!selected.size} onPress={()=>void send()}/>
  {sent>0?<AppText color={String(theme.primary)}>{c.friendRequestsSent}: {sent}</AppText>:null}
  {error?<AppText accessibilityRole="alert" color={String(theme.danger)}>{error}</AppText>:null}
  {directory.isPending||busy?<ActivityIndicator color={String(theme.primary)}/>:null}
  {directory.isError?<ChatAction title={c.retry} onPress={()=>void directory.refetch()}/>:null}
  {users.map(person=>{
   const checked=selected.has(person.id),disabled=busy||person.friendship!=="none"||(!checked&&selected.size>=30);
   return <Pressable key={person.id} accessibilityRole="checkbox" accessibilityLabel={person.name} accessibilityState={{checked,disabled}} disabled={disabled} onPress={()=>setSelected(current=>{const next=new Set(current);if(next.has(person.id))next.delete(person.id);else next.add(person.id);return next;})} style={({pressed})=>({flexDirection:"row",alignItems:"center",gap:12,padding:10,borderRadius:16,backgroundColor:checked||pressed?theme.primarySoft:"transparent",opacity:disabled?0.6:1})}>
    <Avatar userId={person.id} name={person.username||person.name} avatarUrl={person.avatarUrl} size={42}/>
    <View style={{flex:1}}><AppText variant="label" numberOfLines={1}>{person.name}</AppText>{person.username?<AppText muted variant="caption">@{person.username}</AppText>:null}{person.friendship!=="none"?<AppText muted variant="caption">{person.friendship==="friends"?c.alreadyFriends:person.friendship==="incoming"?c.incomingFriendRequest:c.friendRequestPending}</AppText>:null}</View>
    <Ionicons name={checked?"checkmark-circle":"ellipse-outline"} size={24} color={String(checked?theme.primary:theme.textMuted)}/>
   </Pressable>;
  })}
  {!directory.isPending&&!users.length?<AppText muted>{c.directoryEmpty}</AppText>:null}
  {directory.hasNextPage?<ChatAction title={c.moreUsers} disabled={directory.isFetchingNextPage||busy} onPress={()=>void directory.fetchNextPage()}/>:null}
 </ChatSheet>;
}
