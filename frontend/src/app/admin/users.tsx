import { useUiCopy , CopyTextInput as TextInput } from "@/components/localized-native";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { RoleBadge } from "@/components/role-badge";
import { adminApi } from "@/lib/api";
import { useAdminSession } from "@/components/admin/admin-session";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function AdminUsersScreen(){
  const { copyText, copyContent, formatCopy } = useUiCopy();
 const {adminToken}=useAdminSession(),theme=useAppTheme();
 const [newRole,setNewRole]=useState("user");
 const [gridWidth,setGridWidth]=useState(0);
 const columns=gridWidth>=900?6:gridWidth>=650?4:gridWidth>=450?3:gridWidth>=290?2:1;
 const cardWidth=gridWidth>0?(gridWidth-8*(columns-1))/columns:undefined;
 const [nickname,setNickname]=useState("");
 const [q,setQ]=useState(""),[page,setPage]=useState(0),[selected,setSelected]=useState<any>(null),[draft,setDraft]=useState(""),[reason,setReason]=useState(""),[notice,setNotice]=useState(""),[saveError,setSaveError]=useState(""),[busy,setBusy]=useState(false),[reset,setReset]=useState<"money"|"coins"|null>(null),[confirmation,setConfirmation]=useState("");
 const query=useQuery({queryKey:["admin","users",q,page,adminToken],queryFn:()=>adminApi.users(q,page,adminToken)});
 const contact=useQuery({queryKey:["admin","telegram-contact",selected?._id,adminToken],queryFn:()=>adminApi.telegramContact(selected._id,adminToken),enabled:Boolean(selected?._id)});
 const input={color:theme.text,borderColor:theme.border,borderWidth:1,borderRadius:12,padding:12,minHeight:46};
 function edit(user:any){setNewRole(user.role??"user");setNickname(user.username??"");setSaveError("");setSelected(user);setReset(null);setReason("");setDraft(JSON.stringify({name:user.name,email:user.email,...(user.countryCode?{countryCode:user.countryCode}:{}),avatarUrl:user.avatarUrl??"",preferences:user.preferences,wallet:{availableUnits:user.wallet.availableUnits},coins:{balance:user.coins.balance}},null,2));}
 async function save(){setSaveError("");setBusy(true);try{if(selected)await adminApi.editUser(selected._id,{expectedUpdatedAt:selected.updatedAt,reason,profile:{...JSON.parse(draft),username:nickname}},adminToken);else if(reset)await adminApi.resetBalances({kind:reset,confirmation,reason,operationId:crypto.randomUUID()},adminToken);setSelected(null);setReset(null);setNotice("Изменения сохранены. Аудит и прежние значения записаны.");await query.refetch();}catch(e){setSaveError(e instanceof SyntaxError?"Проверьте JSON: неверный формат данных.":e instanceof Error?e.message:"Не удалось сохранить изменения.");}finally{setBusy(false);}}
 async function saveRole(){setBusy(true);setSaveError("");try{const result=await adminApi.changeRole(selected._id,{role:newRole,expectedRole:selected.role,reason},adminToken);setSelected(result.user);await query.refetch();setNotice("Роль изменена. Новые права действуют сразу.");}catch(e){setSaveError(e instanceof Error?e.message:"Не удалось изменить роль");}finally{setBusy(false);}}
 return <View style={{gap:14}}><AdminPageHeader title="Пользователи" description="Профили, настройки и текущие балансы. Деньги вводятся в центах: 1000 = $10. История заработка и резерв вывода сохраняются."/>
 <TextInput style={input} placeholder={copyText("Имя, никнейм, email или код приглашения")} placeholderTextColor={String(theme.textMuted)} value={q} onChangeText={v=>{setQ(v);setPage(0);}}/>
 {notice?<AppText accessibilityRole="alert">{copyContent(notice)}</AppText>:null}{query.error?<AppText>{copyContent(String(query.error))}</AppText>:null}
 <AppText>{copyText("Всего: ")}{copyContent(query.data?.total??0)}</AppText>
 <View onLayout={e=>setGridWidth(e.nativeEvent.layout.width)} style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
 {(query.data?.users??[]).map((u:any)=><Pressable key={u._id} accessibilityRole="button" accessibilityLabel={formatCopy("Редактировать {0}, баланс {1} долларов", [u.name, (u.wallet.availableUnits/100).toFixed(2)])} disabled={busy} onPress={()=>edit(u)} style={({pressed})=>({width:cardWidth??"100%",opacity:pressed?0.7:1})}>
 <GlassSurface style={{padding:10,gap:3,borderRadius:14,minHeight:132}}>
 <AppText variant="label" numberOfLines={1}>{u.name}</AppText><RoleBadge role={u.role} />
 <AppText variant="caption" muted numberOfLines={1}>{u.email}</AppText>
 <AppText variant="label" numberOfLines={1}>${copyContent((u.wallet.availableUnits/100).toFixed(2))} · {copyContent(u.coins.balance)} ◇</AppText>
 <AppText variant="caption" muted numberOfLines={1}>{copyText("Заработано $")}{copyContent((u.wallet.lifetimeEarnedUnits/100).toFixed(2))}</AppText>
 </GlassSurface></Pressable>)}
 </View>
 <View style={{flexDirection:"row",gap:10}}><AppButton disabled={page===0||busy} onPress={()=>setPage(p=>p-1)}>{copyText("Назад")}</AppButton><AppButton disabled={(page+1)*25>=(query.data?.total??0)||busy} onPress={()=>setPage(p=>p+1)}>{copyText("Далее")}</AppButton></View>
 <AppText variant="heading">{copyText("Опасная зона")}</AppText><AppText>{copyText("Массовое обнуление затронет все текущие доступные балансы выбранного типа. Резерв заявок на вывод и история начислений не удаляются.")}</AppText>
 {(["money","coins"] as const).map(k=><AppButton key={k} disabled={busy} onPress={()=>{setSaveError("");setReset(k);setSelected(null);setReason("");setConfirmation("");}}>{copyText("Обнулить ")}{copyContent(k==="money"?"деньги":"коины")} {copyText(" у всех")}</AppButton>)}
 <Modal visible={Boolean(selected||reset)} transparent onRequestClose={()=>{if(!busy){setSelected(null);setReset(null);}}}><View style={{flex:1,backgroundColor:"rgba(0,0,0,0.8)",padding:20,justifyContent:"center"}}><ScrollView style={{maxHeight:"90%"}} keyboardShouldPersistTaps="handled"><View style={{backgroundColor:theme.surfaceRaised,padding:20,borderRadius:20,gap:12}}>
 <AppText variant="heading">{copyContent(selected?`Редактирование: ${selected.name}`:"Массовое обнуление")}</AppText>
 {selected?<>{contact.data?.contact?<View style={{padding:12,gap:5,borderRadius:12,backgroundColor:theme.primarySoft}}><AppText variant="label">Telegram · {contact.data.contact.username?`@${contact.data.contact.username}`:contact.data.contact.telegramId}</AppText><AppText selectable>{contact.data.contact.phoneNumber??copyText("Номер ещё не предоставлен")}</AppText><AppText variant="caption" muted>{copyText("Контакт подтверждён пользователем")}</AppText></View>:null}<AppText>{copyText("Имя, email, страна, аватар, настройки, доступные деньги и коины. Идентификаторы входа, резерв вывода и история защищены от изменения.")}</AppText><AppText variant="label">{copyText("Никнейм (@username)")}</AppText><TextInput accessibilityLabel="Никнейм (@username)" style={input} placeholder={copyText("Например: umar_2026")} placeholderTextColor={String(theme.textMuted)} value={nickname} onChangeText={setNickname} autoCapitalize="none" autoCorrect={false} maxLength={25} editable={!busy}/><AppText variant="caption" muted>{copyText("Никнейм для поиска в чатах: 4–24 латинских буквы, цифры или _, начинается с буквы. Пустое поле удалит никнейм.")}</AppText><TextInput multiline style={[input,{minHeight:360}]} value={draft} onChangeText={setDraft} editable={!busy}/></>:<><AppText>{copyText("Для подтверждения введите RESET ALL ")}{copyContent(reset?.toUpperCase())}{copyText(". Действие затронет всех пользователей.")}</AppText><TextInput style={input} value={confirmation} onChangeText={setConfirmation} editable={!busy}/></>}
 {selected?<View style={{gap:8}}><AppText variant="label">Роль платформы</AppText><View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{["user","manager","admin","owner"].map(role=><Pressable key={role} disabled={busy} accessibilityRole="radio" accessibilityState={{checked:newRole===role}} onPress={()=>setNewRole(role)} style={{padding:12,borderRadius:12,backgroundColor:newRole===role?theme.primarySoft:theme.surface}}><AppText>{role=== "manager"?"Manager":role=== "admin"?"Admin":role==="owner"?"Owner":"User"}</AppText></Pressable>)}</View><AppText variant="caption" muted>Manager — переписка со всеми. Admin — управление. Owner — отчёты и переписка.</AppText><AppButton disabled={busy||newRole===selected.role||reason.trim().length<3} onPress={()=>void saveRole()}>Сохранить роль</AppButton></View>:null}
 <TextInput style={input} placeholder={copyText("Причина изменения (обязательно)")} placeholderTextColor={String(theme.textMuted)} value={reason} onChangeText={setReason} editable={!busy}/>
 {saveError?<AppText accessibilityRole="alert" color={String(theme.danger)}>{copyContent(saveError)}</AppText>:null}
 <AppButton disabled={busy||reason.trim().length<3||Boolean(reset&&confirmation!==`RESET ALL ${reset.toUpperCase()}`)} onPress={()=>void save()}>{copyText("Подтвердить и сохранить")}</AppButton><AppButton disabled={busy} onPress={()=>{setSelected(null);setReset(null);}}>{copyText("Отмена")}</AppButton>
 </View></ScrollView></View></Modal></View>;
}
