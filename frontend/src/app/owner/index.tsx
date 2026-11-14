import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, TextInput, View } from "react-native";
import { AdminBarChart, AdminDataState, AdminMetricCard } from "@/components/admin/admin-ui";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { GlassSurface } from "@/components/glass-surface";
import { ownerApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { useAppTheme } from "@/hooks/use-app-theme";
const money=(units:number)=>`$${(units/100).toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:5})}`;
const statusNames:Record<string,string>={pending_review:"Ожидают проверки",approved:"Одобрены",paid:"Выплачены",rejected:"Отклонены",sandbox_pending:"Тестовые: ожидают",sandbox_completed:"Тестовые: завершены"};
export default function OwnerOverview(){
 const token=useAppStore(s=>s.accessToken)!, theme=useAppTheme();
 const [day,setDay]=useState(new Date().toISOString().slice(0,10)),[days,setDays]=useState(30);
 const valid=/^\d{4}-\d{2}-\d{2}$/.test(day);
 const report=useQuery({queryKey:["owner","analytics",token,day],queryFn:()=>ownerApi.analytics(day,token),enabled:valid,refetchInterval:60000});
 const budget=useQuery({queryKey:["owner","budget",token,days],queryFn:()=>ownerApi.budget(days,token)});
 const withdrawals=useQuery({queryKey:["owner","withdrawals",token],queryFn:()=>ownerApi.withdrawals(token)});
 const to=new Date().toISOString().slice(0,10),from=new Date(Date.now()-(days-1)*86400000).toISOString().slice(0,10);
 const challenges=useQuery({queryKey:["owner","challenges",token,from,to],queryFn:()=>ownerApi.challenges(from,to,token)});
 const o=report.data,b=budget.data;
 return <View style={{gap:20}}>
  <View style={{flexDirection:"row",gap:12,alignItems:"center",flexWrap:"wrap"}}><AppText variant="heading">Обзор за день</AppText><TextInput accessibilityLabel="Дата отчёта" value={day} onChangeText={setDay} placeholder="YYYY-MM-DD" maxLength={10} style={{color:theme.text,borderColor:theme.border,borderWidth:1,borderRadius:12,padding:12,minWidth:150}}/><Pressable accessibilityRole="button" onPress={()=>{void report.refetch();void budget.refetch();void withdrawals.refetch();void challenges.refetch();}} style={{padding:12,backgroundColor:theme.primarySoft,borderRadius:12}}><AppText>Обновить</AppText></Pressable></View>
  <AdminDataState loading={report.isLoading} error={report.error} onRetry={()=>void report.refetch()}/>
  {o?<><AppText muted>{o.dayKey} · Часовой пояс: {o.timezone}</AppText><View style={{flexDirection:"row",flexWrap:"wrap",gap:12}}>{[
   ["Всего пользователей",o.totalUsers],["Регистраций за день",o.registrations],["Рост регистраций",`${o.registrationGrowthPercent??0}%`],["Активные за день",o.activePlayers],["Участники челленджа",o.challengeParticipants],["Завершённые попытки",o.completedAttempts],["Начислено монет",o.coinsIssued],["Денежные начисления",money(o.moneyIssuedUnits)],["Выплачено за челлендж",money(o.settlement?.cashDistributedUnits??0)],
  ].map(([label,value])=><AdminMetricCard key={String(label)} label={String(label)} value={String(value)} icon="stats-chart-outline"/>)}</View></>:null}
  <View style={{flexDirection:"row",gap:12,alignItems:"center",flexWrap:"wrap"}}><AppText variant="heading">Финансы</AppText>{[7,30,90,365].map(n=><Pressable key={n} accessibilityRole="button" accessibilityState={{selected:n===days}} onPress={()=>setDays(n)} style={{padding:12,borderRadius:12,backgroundColor:n===days?theme.primarySoft:theme.surface}}><AppText>{n} дней</AppText></Pressable>)}</View>
  <AdminDataState loading={budget.isPending} error={budget.error} onRetry={()=>void budget.refetch()}/>
  {b?<><AppText muted>{b.range.from} — {b.range.to}. Данные совпадают с отчётами администрации.</AppText><View style={{flexDirection:"row",flexWrap:"wrap",gap:12}}>{[
   ["Общий бюджет",money(b.summary.platformBalanceUnits)],["Доход от рекламы",money(b.summary.adRevenueUnits)],["Другие доходы",money(b.summary.otherRevenueUnits)],["Все доходы",money(b.summary.totalRevenueUnits)],["Операционные расходы",money(b.summary.operatingExpenseUnits)],["Расход на челленджи",money(b.summary.challengeSpendUnits)],["Чистый результат",money(b.summary.netUnits)],["Доход на активного пользователя",money(b.summary.arpuUnits)],["Средний доход в день",money(b.summary.averageDailyRevenueUnits)],["Активных за период",String(b.summary.activeUsers)],["Рост дохода",`${b.summary.growthPercent??0}%`],
  ].map(([label,value])=><AdminMetricCard key={label} label={label!} value={value!} icon="wallet-outline"/>)}</View>
  <GlassSurface style={{padding:20,borderRadius:24,gap:12}}><AppText variant="heading">Доход по дням</AppText><AdminBarChart values={b.daily.map(d=>d.revenueUnits/100)} labels={b.daily.map(d=>d.dayKey.slice(5))} color={String(theme.primary)}/>{b.daily.map(d=><View key={d.dayKey} style={{flexDirection:"row",justifyContent:"space-between",gap:12,flexWrap:"wrap",paddingVertical:6,borderBottomWidth:1,borderColor:theme.border}}><AppText>{d.dayKey}</AppText><AppText>Доход {money(d.revenueUnits)} · Челлендж {money(d.challengeSpendUnits)} · Расход {money(d.operatingExpenseUnits)} · Итог {money(d.netUnits)}</AppText></View>)}</GlassSurface></>:null}
  <AppText variant="heading">Выводы средств · За всё время</AppText><AdminDataState loading={withdrawals.isPending} error={withdrawals.error} onRetry={()=>void withdrawals.refetch()}/><View style={{flexDirection:"row",flexWrap:"wrap",gap:12}}>{withdrawals.data?.totals.map(row=><AdminMetricCard key={row._id} label={statusNames[row._id]??row._id} value={money(row.amountUnits)} detail={`${row.count} заявок`} icon="cash-outline"/>)}</View>
  <AppText variant="heading">Челленджи за период</AppText><AdminDataState loading={challenges.isPending} error={challenges.error} onRetry={()=>void challenges.refetch()}/><GlassSurface style={{padding:20,borderRadius:24,gap:12}}>{challenges.data?.challenges.map(c=><View key={c.id} style={{gap:5}}><AppText variant="label">{c.dayKey} · {c.status} · Фонд {money(c.prizePoolUnits)}</AppText><AppText muted>{c.games.map(g=>typeof g.title==="string"?g.title:g.key).join(" · ")}</AppText></View>)}</GlassSurface>
  <AppText variant="heading">Получатели призов за {day}</AppText><AppText muted>До 500 результатов выбранного дня; общие суммы выше учитывают все результаты.</AppText><GlassSurface style={{padding:20,borderRadius:24,gap:12}}>{o?.recipients.map(p=><View key={p.userId} style={{flexDirection:"row",alignItems:"center",gap:12}}><Avatar userId={p.userId} name={p.name} size={38}/><AppText style={{flex:1}}>{p.rank}. {p.name}</AppText><AppText>{p.totalCoins} ◇ · {money(p.cashUnits)}</AppText></View>)}{o&&!o.recipients.length?<AppText muted>Результатов за этот день пока нет.</AppText>:null}</GlassSurface>
 </View>;
}
