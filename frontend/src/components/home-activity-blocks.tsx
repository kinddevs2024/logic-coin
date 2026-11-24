import {useEffect,useLayoutEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {Animated,AccessibilityInfo,AppState,Dimensions,Easing,Image,Modal,Pressable,StyleSheet,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {LinearGradient} from 'expo-linear-gradient';
import Svg, {Path} from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useQuery} from '@tanstack/react-query';
import {useIsFocused,useRouter} from 'expo-router';
import {useReducedMotion} from 'react-native-reanimated';
import {AppText} from './app-text';
import {Avatar} from './avatar';
import {GlassSurface} from './glass-surface';
import {ChallengeEmptyState} from './challenge-empty-state';
import {gameCoverFor} from '@/constants/game-covers';
import {useAppTheme} from '@/hooks/use-app-theme';
import {useTranslation} from '@/hooks/use-translation';
import {useAppStore} from '@/store/app-store';
import {getHomeActivity,type HomeActivityPeriod} from '@/lib/home-activity';
import {formatMoney} from '@/lib/format';
import type {TodayChallenges} from '@/types';
export type HomeActivityBlocksProps={today?:TodayChallenges;pendingGameKey?:string|null;challengesTarget:RefObject<View|null>};
const copy={uz:{today:'Bugungi o‘yinlar',week:'Haftalik faollik',month:'Oylik faollik',show:'Barcha o‘yinlarni ko‘rsatish',hide:'O‘yinlarni yig‘ish',you:'Siz',empty:'Hozircha ishtirokchilar yo‘q',loading:'Yuklanmoqda…',retry:'Faollik yuklanmadi. Qayta urinish',guest:'Faolligingizni ko‘rish uchun kiring',outWeek:'Haftalik faollikdan tashqarida',outMonth:'Oylik faollikdan tashqarida',day:'k'},ru:{today:'Игры на сегодня',week:'Недельный актив',month:'Месячный актив',show:'Показать все игры',hide:'Свернуть игры',you:'Вы',empty:'Пока нет участников',loading:'Загрузка…',retry:'Не удалось загрузить. Повторить',guest:'Войдите, чтобы видеть активность',outWeek:'Вне недельного актива',outMonth:'Вне месячного актива',day:'д'},en:{today:'Today’s games',week:'Weekly activity',month:'Monthly activity',show:'Show all games',hide:'Collapse games',you:'You',empty:'No participants yet',loading:'Loading…',retry:'Could not load. Retry',guest:'Sign in to see activity',outWeek:'Outside weekly activity',outMonth:'Outside monthly activity',day:'d'}};
const rulesCopy={uz:{week:'Kun hisoblanishi uchun 6 ta o‘yinni tugating. Haftada 2 kun qoldirish mumkin; uchinchi kun qoldirilsa, keyingi haftagacha faollikdan chiqasiz. Bugun faqat kun tugagach hisoblanadi. Ro‘yxat g‘oliblarni emas, ishtirokchilarni ko‘rsatadi.',month:'Kun hisoblanishi uchun 6 ta o‘yinni tugating. Oyda 4 kun qoldirish mumkin; beshinchi kun qoldirilsa, keyingi oygacha faollikdan chiqasiz. Bugun faqat kun tugagach hisoblanadi. Ro‘yxat g‘oliblarni emas, ishtirokchilarni ko‘rsatadi.',close:'Tushunarli'},ru:{week:'Завершите все 6 игр, чтобы день засчитался. За неделю можно пропустить 2 дня; после третьего пропуска вы выходите из актива до следующей недели. Сегодня считается пропуском только после окончания дня. Список показывает участников, а не победителей.',month:'Завершите все 6 игр, чтобы день засчитался. За месяц можно пропустить 4 дня; после пятого пропуска вы выходите из актива до следующего месяца. Сегодня считается пропуском только после окончания дня. Список показывает участников, а не победителей.',close:'Понятно'},en:{week:'Complete all 6 games for a day to count. You can miss 2 days per week; after the third missed day you leave until next week. Today counts as missed only after it ends. The list shows participants, not winners.',month:'Complete all 6 games for a day to count. You can miss 4 days per month; after the fifth missed day you leave until next month. Today counts as missed only after it ends. The list shows participants, not winners.',close:'Got it'}};
function remaining(end:string|undefined,now:number,day:string){if(!end||!Number.isFinite(Date.parse(end)))return '—';const s=Math.max(0,Math.ceil((Date.parse(end)-now)/1000)),d=Math.floor(s/86400);return `${d?`${d}${day} `:''}${[Math.floor(s/3600)%24,Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':')}`;}
function Countdown({end,offset,day,active}:{end?:string;offset:number;day:string;active:boolean}){const [now,setNow]=useState(Date.now());useEffect(()=>{let timer:ReturnType<typeof setInterval>|undefined;const update=(state:string)=>{if(timer)clearInterval(timer);if(state==='active'&&active){setNow(Date.now());timer=setInterval(()=>setNow(Date.now()),1000)}};update(AppState.currentState);const sub=AppState.addEventListener('change',update);return()=>{sub.remove();if(timer)clearInterval(timer)}},[active]);return <AppText muted style={{fontSize:12}}><Ionicons name="time-outline" size={14}/> {remaining(end,now+offset,day)}</AppText>}
const activityBubbles = [
  {left: '8%', size: 4, phase: .39, ring: false},
  {left: '21%', size: 5, phase: .68, ring: false},
  {left: '29%', size: 8, phase: .48, ring: true},
  {left: '40%', size: 3, phase: .19, ring: false},
  {left: '48%', size: 5, phase: .57, ring: false},
  {left: '57%', size: 9, phase: .61, ring: true},
  {left: '66%', size: 4, phase: .5, ring: false},
  {left: '75%', size: 6, phase: .81, ring: false},
  {left: '85%', size: 7, phase: .55, ring: true},
  {left: '94%', size: 3, phase: .36, ring: false},
] as const;

function FullWater({color, animated}: {color: string; animated: boolean}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(0);
  const running = animated && height > 0;

  useEffect(() => {
    if (!running) return;
    progress.setValue(0);
    const loop = Animated.loop(Animated.timing(progress, {
      toValue: 1,
      duration: 5800,
      easing: Easing.linear,
      useNativeDriver: true,
      isInteraction: false,
    }));
    loop.start();
    return () => loop.stop();
  }, [progress, running]);

  const bubbles = useMemo(() => activityBubbles.map(({left, size, phase, ring}) => {
    const position = Animated.modulo(Animated.add(progress, phase), 1);
    return {
      left,
      size,
      ring,
      opacity: position.interpolate({inputRange: [0, .2, .68, 1], outputRange: [0, .8, .64, 0]}),
      translateX: position.interpolate({inputRange: [0, 1], outputRange: [0, 5]}),
      translateY: position.interpolate({inputRange: [0, 1], outputRange: [0, -height - size]}),
    };
  }), [height, progress]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={event => setHeight(event.nativeEvent.layout.height)}
      style={StyleSheet.absoluteFill}
    >
      <View style={[StyleSheet.absoluteFill, {backgroundColor: color, opacity: .16}]} />
      <LinearGradient
        colors={['rgba(41,82,232,.38)', 'rgba(118,72,221,.43)', 'rgba(104,57,192,.33)']}
        locations={[0, .55, 1]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: .7}}
        style={StyleSheet.absoluteFill}
      />
      {running && bubbles.map(({left, size, ring, opacity, translateX, translateY}) => (
        <Animated.View key={left} style={{
          position: 'absolute',
          left,
          bottom: -size,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring ? 1 : 0,
          borderColor: 'rgba(255,255,255,.85)',
          backgroundColor: ring ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.86)',
          opacity,
          transform: [{translateX}, {translateY}],
        }} />
      ))}
    </View>
  );
}

function Water({percent, color, active}: {percent: number; color: string; active: boolean}) {
  const drift = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const complete = percent === 100;
  const animated = active && foreground && !reduced;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduced(value);
    }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const appState = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => {
      mounted = false;
      motion.remove();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    drift.setValue(0);
    if (complete || !animated) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, {toValue: -24, duration: 2500, useNativeDriver: true, isInteraction: false}),
      Animated.timing(drift, {toValue: 0, duration: 2500, useNativeDriver: true, isInteraction: false}),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animated, complete, drift]);

  if (complete) return <FullWater color={color} animated={animated} />;
  return (
    <View pointerEvents="none" style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.max(30, percent)}%`, opacity: .16}}>
      <View style={{position: 'absolute', left: 0, right: 0, top: 7, bottom: 0, backgroundColor: color}} />
      <Animated.View style={{position: 'absolute', left: -24, right: -24, top: 0, height: 9, transform: [{translateX: drift}]}}>
        <Svg width="100%" height="9" viewBox="0 0 240 12" preserveAspectRatio="none">
          <Path d="M0 6 Q30 0 60 6 T120 6 T180 6 T240 6 V12 H0Z" fill={color} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function Reel({players,language,userId,active}:{players:HomeActivityPeriod['participants'];language:'uz'|'ru'|'en';userId?:string;active:boolean}){
 const theme=useAppTheme(),y=useRef(new Animated.Value(0)).current;
 const [reduce,setReduce]=useState(false),[index,setIndex]=useState(0),[foreground,setForeground]=useState(AppState.currentState==='active');
 useEffect(()=>{AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(()=>{});const s=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce);return()=>s.remove()},[]);
 useEffect(()=>{const s=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>s.remove()},[]);
 useLayoutEffect(()=>{y.setValue(0);if(players.length<4||reduce||!active||!foreground)return;const animation=Animated.timing(y,{toValue:-64,duration:2600,useNativeDriver:true});animation.start(({finished})=>{if(finished)setIndex(value=>(value+1)%players.length)});return()=>animation.stop()},[players.length,reduce,active,foreground,index,y]);
 const rows=players.length>=4?Array.from({length:Math.min(players.length,4)+1},(_,i)=>players[(index+i)%players.length]!):players;
 return <View style={{height:220,borderWidth:1,borderColor:String(theme.border),borderRadius:23,overflow:'hidden',justifyContent:players.length<4?'center':'flex-start'}}><Animated.View style={{transform:[{translateY:y}]}}>{rows.map((p,i)=><View key={players.length===4&&i===4?`${p.id}-duplicate`:p.id} style={{height:64,flexDirection:'row',alignItems:'center',gap:12,width:'100%',maxWidth:290,alignSelf:'center',paddingHorizontal:20}}><Avatar userId={p.id} name={p.name} avatarUrl={p.avatarUrl} size={42}/><View style={{flex:1}}><AppText numberOfLines={1} style={{fontWeight:'700',fontSize:14}}>{p.id===userId?`${copy[language].you} · `:''}{p.name}</AppText><View style={{flexDirection:'row',alignItems:'center',gap:5,marginTop:3}}><Ionicons name="diamond-outline" size={14} color={String(theme.primary)}/><AppText muted style={{fontSize:11}}>{p.coins.toLocaleString(language)}</AppText><Ionicons name="wallet-outline" size={14} color={String(theme.primary)}/><AppText muted style={{fontSize:11}}>{formatMoney(p.balanceUnits)}</AppText></View></View></View>)}</Animated.View></View>
}
export function HomeActivityBlocks({today,pendingGameKey,challengesTarget}:HomeActivityBlocksProps){const theme=useAppTheme(),{language}=useTranslation(),c=copy[language],router=useRouter(),focused=useIsFocused();const user=useAppStore(s=>s.user),token=useAppStore(s=>s.accessToken),authMode=useAppStore(s=>s.authMode),coins=useAppStore(s=>s.coinBalance),balance=useAppStore(s=>s.balanceUnits);const auth=authMode==='authenticated'&&!!token;const q=useQuery({queryKey:['home-activity',token,today?.dayKey,today?.completedCount],queryFn:()=>getHomeActivity(token!),enabled:auth,staleTime:60000,refetchInterval:focused?60000:false});const [expanded,setExpanded]=useState(false),[rules,setRules]=useState<'week'|'month'|null>(null);const weekRef=useRef<View>(null),monthRef=useRef<View>(null),seen=useRef(new Set<string>()),modal=useRef(false);modal.current=!!rules;const weekFrom=q.data?.week.from,monthFrom=q.data?.month.from;useEffect(()=>{if(!auth||!user.id||!focused)return;let live=true;const check=async(kind:'week'|'month',from?:string)=>{if(!from||modal.current||!live||AppState.currentState!=='active')return;const key=`lc-${kind}-rules:${user.id}:${from}`;if(seen.current.has(key))return;try{if(await AsyncStorage.getItem(key)){seen.current.add(key);return}}catch{return}const ref=kind==='week'?weekRef:monthRef;ref.current?.measureInWindow((_x,y,_w,h)=>{if(!live||modal.current||y<90||y+h>Dimensions.get('window').height-90)return;seen.current.add(key);modal.current=true;setRules(kind);void AsyncStorage.setItem(key,'seen').catch(()=>{})})};const t=setInterval(()=>{void check('week',weekFrom);void check('month',monthFrom)},1500);return()=>{live=false;clearInterval(t)}},[auth,user.id,weekFrom,monthFrom,focused]);const clockOffset=q.data?Date.parse(q.data.serverNow)-q.dataUpdatedAt:0,games=today?.games??[];const expansion=useRef(new Animated.Value(0)).current,reduceMotion=useReducedMotion();useEffect(()=>{const animation=Animated.timing(expansion,{toValue:expanded?1:0,duration:reduceMotion?0:380,easing:Easing.bezier(.2,.8,.2,1),useNativeDriver:false});animation.start();return()=>animation.stop()},[expanded,expansion,reduceMotion]);
const heading=(name:string,end?:string,kind?:'week'|'month')=><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14}}><View style={{flexDirection:'row',alignItems:'center',gap:6,flexShrink:1}}><AppText style={{fontSize:18,fontWeight:'800'}}>{name}</AppText>{kind?<Pressable accessibilityRole="button" accessibilityLabel={name} hitSlop={10} onPress={()=>setRules(kind)}><Ionicons name="information-circle-outline" size={18} color={String(theme.textMuted)}/></Pressable>:null}</View><Countdown end={end} offset={clockOffset} day={c.day} active={focused}/></View>;
const period=(kind:'week'|'month')=>{const p=q.data?.[kind],fresh=kind==='week'?today?.weeklyCompletedDays:today?.monthlyCompletedDays,done=p?Math.max(p.completedDays,q.data?.dayKey===today?.dayKey?fresh??0:0):undefined,pct=p&&done!==undefined?Math.min(100,Math.round(done/p.totalDays*100)):null,sample=p?.participants??[],players=p?.eligible&&user.id&&!sample.some(x=>x.id===user.id)?[...sample,{id:user.id,name:user.name,avatarUrl:user.avatarUrl??null,coins,balanceUnits:balance}]:sample;return <GlassSurface variant="strong" style={{padding:18,borderRadius:28,marginTop:16}}><View ref={kind==='week'?weekRef:monthRef} collapsable={false}>{heading(c[kind],p?.endsAt,kind)}</View>{players.length?<Reel players={players} language={language} userId={user.id} active={focused}/>:<View style={{height:150,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:String(theme.border),borderRadius:23}}><Pressable disabled={!q.isError} onPress={()=>void q.refetch()}><AppText muted>{!auth?c.guest:q.isError?c.retry:q.isPending?c.loading:c.empty}</AppText></Pressable></View>}<View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:pct??undefined}} style={{marginTop:12,borderRadius:18,overflow:'hidden',minHeight:62,flexDirection:'row',alignItems:'center',padding:10,gap:10,backgroundColor:String(theme.surfaceMuted)}}><Water percent={pct??0} color={String(theme.primary)} active={focused}/><Avatar userId={user.id} name={user.name} avatarUrl={user.avatarUrl} size={40}/><View style={{flex:1}}><AppText numberOfLines={1} style={{fontWeight:'700'}}>{c.you} · {user.name}</AppText>{p&&!p.eligible?<AppText muted style={{fontSize:11}}>{kind==='week'?c.outWeek:c.outMonth}</AppText>:null}</View><AppText style={{fontSize:20,fontWeight:'800'}}>{pct===null?'—':`${pct}%`}</AppText></View></GlassSurface>};
return <View testID="native-home-activity" style={{width:'100%',marginTop:18}}><GlassSurface variant="strong" style={{padding:18,borderRadius:28}}>{heading(c.today,today?.endsAt??undefined)}<Animated.View style={{height:expansion.interpolate({inputRange:[0,1],outputRange:[160,Math.max(160,games.length*73)]}),overflow:'hidden'}}>{games.map((g,i)=>{const done=g.state.status==='completed';return <View key={g.key} ref={i===0?challengesTarget:undefined} collapsable={false} accessibilityElementsHidden={!expanded&&i>=2} importantForAccessibility={!expanded&&i>=2?'no-hide-descendants':'auto'}><Pressable disabled={done||pendingGameKey===g.key||(!expanded&&i>=2)} onPress={()=>router.push({pathname:'/play/[gameKey]',params:{gameKey:g.key,mode:'challenge'}} as never)} style={{height:64,marginBottom:9,borderRadius:40,borderWidth:1,borderColor:String(theme.border),backgroundColor:String(theme.surfaceMuted),flexDirection:'row',alignItems:'center',paddingHorizontal:9,gap:10}}><Image source={gameCoverFor(g.key)} style={{width:46,height:46,borderRadius:23}}/><AppText numberOfLines={1} style={{flex:1,fontWeight:'700'}}>{g.title}</AppText>{done?<AppText style={{fontSize:11,color:theme.primary}}>💎 +{g.state.coinsAwarded}</AppText>:null}<View style={{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:done?String(theme.surfaceMuted):String(theme.primary)}}><Ionicons name={done?'checkmark':'arrow-forward'} size={21} color={String(done?theme.primary:theme.onPrimary)}/></View></Pressable></View>})}{!games.length?<View ref={challengesTarget} collapsable={false}><ChallengeEmptyState compact/></View>:null}{games.length>2?<Animated.View pointerEvents="none" style={{position:'absolute',bottom:0,left:0,right:0,height:32,opacity:expansion.interpolate({inputRange:[0,1],outputRange:[1,0]})}}><LinearGradient colors={['transparent',String(theme.surfaceRaised)]} style={{flex:1}}/></Animated.View>:null}</Animated.View>{games.length>2?<Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)} style={{minHeight:45,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingTop:3}}><AppText style={{color:theme.primary,fontWeight:'700'}}>{expanded?c.hide:c.show}</AppText><Animated.View style={{transform:[{rotate:expansion.interpolate({inputRange:[0,1],outputRange:['0deg','180deg']})}]}}><Ionicons name="chevron-down" size={18} color={String(theme.primary)}/></Animated.View></Pressable>:null}</GlassSurface>{period('week')}{period('month')}{rules?<Modal visible transparent animationType="fade" onRequestClose={()=>setRules(null)}><View style={{flex:1,backgroundColor:'rgba(0,0,0,.45)',justifyContent:'center',padding:20}}><GlassSurface variant="strong" style={{padding:22,borderRadius:26,gap:16}}><AppText style={{fontSize:20,fontWeight:'800'}}>{c[rules]}</AppText><AppText>{rulesCopy[language][rules]}</AppText><Pressable accessibilityRole="button" onPress={()=>setRules(null)} style={{minHeight:44,alignItems:'center',justifyContent:'center'}}><AppText style={{color:theme.primary,fontWeight:'700'}}>{rulesCopy[language].close}</AppText></Pressable></GlassSurface></View></Modal>:null}</View>}
