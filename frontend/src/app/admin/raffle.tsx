import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminSession } from "@/components/admin/admin-session";
import { AdminPageHeader, AdminDataState } from "@/components/admin/admin-ui";
import { AppButton } from "@/components/buttons";
import { StyledInput } from "@/components/styled-input";
import { GlassSurface } from "@/components/glass-surface";
import { YoutubePlayer } from "@/components/youtube-player";
import { useTranslation } from "@/hooks/use-translation";
import { useAppTheme } from "@/hooks/use-app-theme";
import { raffleApi, raffleCopy } from "@/lib/raffle";
type Prize = { label:string; kind:"cash"|"physical"; amount:string; duration:string };
export default function AdminRaffleScreen() {
 const {adminToken}=useAdminSession();const {language}=useTranslation();const c=raffleCopy[language];const theme=useAppTheme();const qc=useQueryClient();
 const l=(ru:string,uz:string,en:string)=>language==="ru"?ru:language==="uz"?uz:en;
 const [title,setTitle]=useState("");const [date,setDate]=useState("");const [time,setTime]=useState("");const [lock,setLock]=useState("3");const [url,setUrl]=useState("");const [repeat,setRepeat]=useState(false);
 const [prizes,setPrizes]=useState<Prize[]>([{label:"",kind:"cash",amount:"",duration:"15"}]);const [confirmation,setConfirmation]=useState<{id:string;action:"publish"|"end";cancel?:boolean}|null>(null);
 const query=useQuery({queryKey:["admin-raffle",adminToken],queryFn:()=>raffleApi.admin(adminToken),refetchInterval:3000});
 const refresh=()=>qc.invalidateQueries({queryKey:["admin-raffle"]});
 const create=useMutation({mutationFn:()=>{
  const startsAt=new Date(`${date}T${time}:00+05:00`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time)||!Number.isFinite(startsAt.getTime())||prizes.some(p=>p.kind==="cash"&&!/^\d+(?:\.\d{1,2})?$/.test(p.amount)))throw Error(l("Проверьте дату, время и суммы призов","Sana, vaqt va sovrin miqdorini tekshiring","Check date, time and prize amounts"));
  return raffleApi.create(adminToken,{title,startsAt:startsAt.toISOString(),lockMinutes:Number(lock),youtubeUrl:url,allowRepeatWinners:repeat,rounds:prizes.map(p=>({label:p.label,kind:p.kind,cashUnits:p.kind==="cash"?Math.round(Number(p.amount)*100):0,durationSeconds:Number(p.duration)}))});
 },onSuccess:()=>void refresh()});
 const action=useMutation({mutationFn:(input:{id:string;action:"publish"|"spin"|"end";body?:object})=>raffleApi.action(adminToken,input.id,input.action,input.body),onSuccess:()=>{setConfirmation(null);void refresh();}});
 const event=query.data?.event;const history=query.data?.history??[];const draft=history.find(e=>e.status==="draft");
 const change=(i:number,input:Partial<Prize>)=>setPrizes(old=>old.map((p,j)=>i===j?{...p,...input}:p));const error=create.error??action.error;
 const status=(value:string)=>({draft:l("Черновик","Qoralama","Draft"),scheduled:l("Запланирован","Rejalashtirilgan","Scheduled"),live:c.live,ended:l("Завершён","Yakunlangan","Ended"),cancelled:l("Отменён","Bekor qilingan","Cancelled"),pending:l("Ожидает","Kutilmoqda","Pending"),spinning:c.spinning,finished:l("Завершён","Yakunlangan","Finished")}[value]??value);
 const end=l("Завершить событие","Tadbirni yakunlash","End event"),cancel=l("Отменить событие","Tadbirni bekor qilish","Cancel event");
 const text={color:theme.text};const panel={padding:22,gap:16,borderRadius:24} as const;
 return <View style={{gap:20}}>
  <AdminPageHeader title={c.title} description={l("Расписание, эфир и призовые раунды","Jadval, efir va sovrinli bosqichlar","Schedule, live stream and prize rounds")}/>
  <Text style={{color:theme.textMuted,lineHeight:22}}>{c.rules}</Text>
  {error?<Text accessibilityRole="alert" style={{color:theme.danger}}>{error.message}</Text>:null}
  {query.isPending?<AdminDataState loading/>:query.error?<AdminDataState error={query.error} onRetry={()=>void query.refetch()}/>:null}
  {event?<GlassSurface variant="strong" style={panel}>
   <Text style={[text,{fontSize:22,fontWeight:"800"}]}>{event.title} · {status(event.status)}</Text>
   <Text style={{color:theme.primary}}>{l("Онлайн","Onlayn","Online")}: {event.onlineCount} · {l("Подходят для участия","Ishtirok etishi mumkin","Eligible")}: {event.eligibleOnlineCount}</Text>
   <YoutubePlayer videoId={event.youtubeId}/>
   {event.rounds.map((r,i)=><View key={r.id} style={{padding:14,borderWidth:1,borderColor:theme.border,borderRadius:16,gap:10}}><Text style={[text,{fontWeight:"700"}]}>{i+1}. {r.label} · {r.kind==="cash"?`$${(r.cashUnits/100).toFixed(2)}`:l("Физический приз","Jismoniy sovrin","Physical prize")}</Text><Text style={{color:theme.textMuted}}>{status(r.status)}</Text>
    {r.status==="pending"?<AppButton disabled={event.status!=="live"||action.isPending||event.rounds.some(x=>x.status==="spinning")||event.rounds.find(x=>x.status==="pending")?.id!==r.id} onPress={()=>action.mutate({id:event.id,action:"spin",body:{roundId:r.id}})}>{l("Запустить раунд","Bosqichni boshlash","Start round")}</AppButton>:null}</View>)}
   <AppButton disabled={action.isPending||event.rounds.some(r=>r.status==="spinning")} onPress={()=>setConfirmation({id:event.id,action:"end",cancel:false})}>{end}</AppButton>
   <AppButton disabled={action.isPending||event.rounds.some(r=>r.status==="spinning")} onPress={()=>setConfirmation({id:event.id,action:"end",cancel:true})}>{cancel}</AppButton>
  </GlassSurface>:null}
  {draft?<GlassSurface variant="strong" style={panel}><Text style={[text,{fontWeight:"800"}]}>{status("draft")}: {draft.title}</Text><Text style={{color:theme.textMuted}}>{new Date(draft.startsAt).toLocaleString(language,{timeZone:"Asia/Tashkent"})} · Toshkent</Text><Text style={{color:theme.textMuted}}>{l("Пользователи пока не видят это событие","Foydalanuvchilar bu tadbirni hali ko‘rmaydi","This event is not yet visible to users")}</Text>
   <AppButton disabled={action.isPending} onPress={()=>setConfirmation({id:draft._id,action:"publish"})}>{l("Опубликовать расписание","Jadvalni e’lon qilish","Publish schedule")}</AppButton><AppButton disabled={action.isPending} onPress={()=>action.mutate({id:draft._id,action:"end",body:{cancel:true}})}>{cancel}</AppButton></GlassSurface>:null}
  {confirmation?<GlassSurface variant="strong" style={{...panel,borderWidth:2,borderColor:theme.warning}}><Text style={[text,{fontWeight:"800"}]}>{l("Подтвердите действие","Amalni tasdiqlang","Confirm action")}</Text><Text style={{color:theme.textMuted}}>{confirmation.action==="publish"?l("Событие станет видно всем, начнут отправляться уведомления.","Tadbir barchaga ko‘rinadi va bildirishnomalar yuboriladi.","The event will become visible and notifications will be sent."):l("Полноэкранное событие закроется у всех.","To‘liq ekran barcha foydalanuvchilarda yopiladi.","The full-screen event will close for everyone.")}</Text><AppButton loading={action.isPending} onPress={()=>action.mutate({id:confirmation.id,action:confirmation.action,body:confirmation.action==="end"?{cancel:confirmation.cancel??false}:{}})}>{l("Подтвердить","Tasdiqlash","Confirm")}</AppButton><AppButton onPress={()=>setConfirmation(null)}>{l("Назад","Orqaga","Back")}</AppButton></GlassSurface>:null}
  {!event&&!draft?<GlassSurface variant="strong" style={panel}>
   <StyledInput label={l("Название события","Tadbir nomi","Event name")} value={title} onChangeText={setTitle}/><StyledInput label={l("Дата (ГГГГ-ММ-ДД)","Sana (YYYY-MM-DD)","Date (YYYY-MM-DD)")} placeholder="2026-11-05" value={date} onChangeText={setDate}/><StyledInput label={l("Время в Ташкенте (ЧЧ:ММ)","Toshkent vaqti (HH:MM)","Tashkent time (HH:MM)")} placeholder="20:00" value={time} onChangeText={setTime}/><StyledInput label={l("Полноэкранный таймер за минут до начала","To‘liq ekran: boshlanishdan necha daqiqa oldin","Full screen: minutes before start")} value={lock} onChangeText={setLock} keyboardType="number-pad"/>
   <StyledInput label={l("Ссылка на YouTube-эфир","YouTube efir havolasi","YouTube live stream URL")} placeholder="https://www.youtube.com/live/..." value={url} onChangeText={setUrl}/>
   {youtubeId(url)?<YoutubePlayer videoId={youtubeId(url)!}/>:null}
   <View style={{flexDirection:"row",alignItems:"center",gap:16}}><Switch value={repeat} onValueChange={setRepeat}/><Text style={[text,{flex:1}]}>{l("Повторные победы разрешены","Qayta yutishga ruxsat","Allow repeat winners")}</Text></View>
   {prizes.map((p,i)=><View key={i} style={{gap:12,padding:16,borderWidth:1,borderColor:theme.border,borderRadius:18}}>
    <Text style={{color:theme.primary,fontWeight:"800"}}>#{i+1}</Text><StyledInput label={l("Описание приза","Sovrin tavsifi","Prize description")} value={p.label} onChangeText={label=>change(i,{label})}/>
    <View style={{flexDirection:"row",gap:8}}>{(["cash","physical"] as const).map(kind=><Pressable key={kind} accessibilityRole="radio" accessibilityState={{checked:p.kind===kind}} onPress={()=>change(i,{kind})} style={{flex:1,padding:12,borderRadius:14,backgroundColor:p.kind===kind?theme.primarySoft:theme.surface}}><Text style={[text,{textAlign:"center"}]}>{kind==="cash"?l("Деньги на баланс","Balansga pul","Cash to balance"):l("Физический приз","Jismoniy sovrin","Physical prize")}</Text></Pressable>)}</View>
    {p.kind==="cash"?<StyledInput label={l("Сумма в $","Miqdor ($)","Amount ($)")} placeholder="10.00" value={p.amount} onChangeText={amount=>change(i,{amount})} keyboardType="decimal-pad"/>:null}
    <StyledInput label={l("Вращение, секунд","Aylanish, soniya","Spin duration (seconds)")} value={p.duration} onChangeText={duration=>change(i,{duration})} keyboardType="number-pad"/>
    {prizes.length>1?<AppButton onPress={()=>setPrizes(old=>old.filter((_,j)=>i!==j))}>{l("Удалить","O‘chirish","Remove")}</AppButton>:null}
   </View>)}
   <AppButton disabled={prizes.length>=50} onPress={()=>setPrizes(old=>[...old,{label:"",kind:"physical",amount:"",duration:"15"}])}>{l("Добавить раунд","Bosqich qo‘shish","Add round")}</AppButton>
   <AppButton loading={create.isPending} onPress={()=>create.mutate()}>{l("Сохранить черновик","Qoralamani saqlash","Save draft")}</AppButton>
  </GlassSurface>:null}
  <Text style={[text,{fontSize:20,fontWeight:"800"}]}>{l("События","Tadbirlar","Events")}</Text>
  {history.map(h=><View key={h._id} style={{padding:16,borderWidth:1,borderColor:theme.border,borderRadius:16}}><Text style={[text,{fontWeight:"700"}]}>{h.title}</Text><Text style={{color:theme.textMuted}}>{status(h.status)} · {new Date(h.startsAt).toLocaleString(language,{timeZone:"Asia/Tashkent"})}</Text></View>)}
 </View>;
}
function youtubeId(value:string){try{const u=new URL(value);if(u.protocol!=="https:")return null;const id=u.hostname==="youtu.be"?u.pathname.slice(1):["youtube.com","www.youtube.com","m.youtube.com"].includes(u.hostname)?u.searchParams.get("v")??u.pathname.match(/^\/(?:live|embed)\/([^/]+)/)?.[1]:null;return id&&/^[a-zA-Z0-9_-]{11}$/.test(id)?id:null;}catch{return null;}}
