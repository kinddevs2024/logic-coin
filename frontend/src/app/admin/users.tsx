import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { adminApi } from "@/lib/api";
import { useAdminSession } from "@/components/admin/admin-session";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function AdminUsersScreen(){
 const {adminToken}=useAdminSession(),theme=useAppTheme();
 const [gridWidth,setGridWidth]=useState(0);
 const columns=gridWidth>=900?6:gridWidth>=650?4:gridWidth>=450?3:gridWidth>=290?2:1;
 const cardWidth=gridWidth>0?(gridWidth-8*(columns-1))/columns:undefined;
 const [q,setQ]=useState(""),[page,setPage]=useState(0),[selected,setSelected]=useState<any>(null),[draft,setDraft]=useState(""),[reason,setReason]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[reset,setReset]=useState<"money"|"coins"|null>(null),[confirmation,setConfirmation]=useState("");
 const query=useQuery({queryKey:["admin","users",q,page,adminToken],queryFn:()=>adminApi.users(q,page,adminToken)});
 const input={color:theme.text,borderColor:theme.border,borderWidth:1,borderRadius:12,padding:12,minHeight:46};
 function edit(user:any){setSelected(user);setReset(null);setReason("");setDraft(JSON.stringify({name:user.name,email:user.email,...(user.countryCode?{countryCode:user.countryCode}:{}),avatarUrl:user.avatarUrl??"",preferences:user.preferences,wallet:{availableUnits:user.wallet.availableUnits},coins:{balance:user.coins.balance}},null,2));}
 async function save(){setBusy(true);try{if(selected)await adminApi.editUser(selected._id,{expectedUpdatedAt:selected.updatedAt,reason,profile:JSON.parse(draft)},adminToken);else if(reset)await adminApi.resetBalances({kind:reset,confirmation,reason,operationId:crypto.randomUUID()},adminToken);setSelected(null);setReset(null);setNotice("Изменения сохранены. Аудит и прежние значения записаны.");await query.refetch();}catch(e){setNotice(e instanceof Error?e.message:"Ошибка");}finally{setBusy(false);}}
 return <View style={{gap:14}}><AdminPageHeader title="Пользователи" description="Профили, настройки и текущие балансы. Деньги вводятся в центах: 1000 = $10. История заработка и резерв вывода сохраняются."/>
 <TextInput style={input} placeholder="Имя, email или код приглашения" placeholderTextColor={String(theme.textMuted)} value={q} onChangeText={v=>{setQ(v);setPage(0);}}/>
 {notice?<AppText accessibilityRole="alert">{notice}</AppText>:null}{query.error?<AppText>{String(query.error)}</AppText>:null}
 <AppText>Всего: {query.data?.total??0}</AppText>
 <View onLayout={e=>setGridWidth(e.nativeEvent.layout.width)} style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
 {(query.data?.users??[]).map((u:any)=><Pressable key={u._id} accessibilityRole="button" accessibilityLabel={`Редактировать ${u.name}, баланс ${(u.wallet.availableUnits/100).toFixed(2)} долларов`} disabled={busy} onPress={()=>edit(u)} style={({pressed})=>({width:cardWidth??"100%",opacity:pressed?0.7:1})}>
 <GlassSurface style={{padding:10,gap:3,borderRadius:14,height:116}}>
 <AppText variant="label" numberOfLines={1}>{u.name}</AppText>
 <AppText variant="caption" muted numberOfLines={1}>{u.email}</AppText>
 <AppText variant="label" numberOfLines={1}>${(u.wallet.availableUnits/100).toFixed(2)} · {u.coins.balance} ◇</AppText>
 <AppText variant="caption" muted numberOfLines={1}>Заработано ${(u.wallet.lifetimeEarnedUnits/100).toFixed(2)}</AppText>
 </GlassSurface></Pressable>)}
 </View>
 <View style={{flexDirection:"row",gap:10}}><AppButton disabled={page===0||busy} onPress={()=>setPage(p=>p-1)}>Назад</AppButton><AppButton disabled={(page+1)*25>=(query.data?.total??0)||busy} onPress={()=>setPage(p=>p+1)}>Далее</AppButton></View>
 <AppText variant="heading">Опасная зона</AppText><AppText>Массовое обнуление затронет все текущие доступные балансы выбранного типа. Резерв заявок на вывод и история начислений не удаляются.</AppText>
 {(["money","coins"] as const).map(k=><AppButton key={k} disabled={busy} onPress={()=>{setReset(k);setSelected(null);setReason("");setConfirmation("");}}>Обнулить {k==="money"?"деньги":"коины"} у всех</AppButton>)}
 <Modal visible={Boolean(selected||reset)} transparent onRequestClose={()=>{if(!busy){setSelected(null);setReset(null);}}}><View style={{flex:1,backgroundColor:"rgba(0,0,0,0.8)",padding:20,justifyContent:"center"}}><ScrollView style={{maxHeight:"90%"}} keyboardShouldPersistTaps="handled"><View style={{backgroundColor:theme.surfaceRaised,padding:20,borderRadius:20,gap:12}}>
 <AppText variant="heading">{selected?`Редактирование: ${selected.name}`:"Массовое обнуление"}</AppText>
 {selected?<><AppText>Имя, email, страна, аватар, настройки, доступные деньги и коины. Идентификаторы входа, резерв вывода и история защищены от изменения.</AppText><TextInput multiline style={[input,{minHeight:360}]} value={draft} onChangeText={setDraft} editable={!busy}/></>:<><AppText>Для подтверждения введите RESET ALL {reset?.toUpperCase()}. Действие затронет всех пользователей.</AppText><TextInput style={input} value={confirmation} onChangeText={setConfirmation} editable={!busy}/></>}
 <TextInput style={input} placeholder="Причина изменения (обязательно)" placeholderTextColor={String(theme.textMuted)} value={reason} onChangeText={setReason} editable={!busy}/>
 <AppButton disabled={busy||reason.trim().length<3||Boolean(reset&&confirmation!==`RESET ALL ${reset.toUpperCase()}`)} onPress={()=>void save()}>Подтвердить и сохранить</AppButton><AppButton disabled={busy} onPress={()=>{setSelected(null);setReset(null);}}>Отмена</AppButton>
 </View></ScrollView></View></Modal></View>;
}
