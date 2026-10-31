import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "@/hooks/use-translation";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAppStore } from "@/store/app-store";
import { raffleCopy, type RaffleEvent, type RafflePlayer } from "@/lib/raffle";
import { bootstrapApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { Avatar } from "./avatar";
import { YoutubePlayer } from "./youtube-player";
export function RaffleStage({ event, now, eligibleDays }: { event: RaffleEvent; now: number; eligibleDays: number }) {
  const { language } = useTranslation(); const c = raffleCopy[language]; const theme = useAppTheme();
  const userId = useAppStore(s => s.user.id);
  const seconds = Math.max(0, Math.ceil((Date.parse(event.startsAt) - now) / 1000));
  const [scale] = useState(() => new Animated.Value(1));
  const reduceMotion = useRef(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const round = event.current;
  const winner = round?.status === "finished" ? round.winner : null;
  const credited = useRef<string | null>(null);
  useEffect(() => {
    const account = useAppStore.getState();
    if (!winner || !round || winner.id !== account.user.id || credited.current === round.id || !account.accessToken) return;
    credited.current = round.id;
    void bootstrapApi.get(account.accessToken).then(value => useAppStore.getState().syncBootstrap(value)).catch(() => {});
  }, [winner, round]);
  const won = Boolean(winner && winner.id === userId);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(value => { reduceMotion.current = value; }); }, []);
  useEffect(() => {
    if (seconds > 60 || seconds === 0 || reduceMotion.current) return;
    scale.setValue(1.45); const animation = Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }); animation.start(); return () => animation.stop();
  }, [scale, seconds]);
  useEffect(() => { if (!event.locked) return; const subscription = BackHandler.addEventListener("hardwareBackPress", () => true); return () => subscription.remove(); }, [event.locked]);
  const colors = ["#4FE2B6", "#FFD95E", "#FFFFFF", "#FE8797"];
  return <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow, { color: theme.primary }]}>{seconds > 0 ? c.starts : c.live}</Text>
      <Text style={[styles.heading, { color: theme.text }]}>{event.title}</Text>
      {seconds > 0 ? <View style={styles.countdown}>
        <Animated.Text accessibilityLiveRegion={seconds % 10 === 0 || seconds <= 10 ? "polite" : "none"} style={[styles.digits, { color: colors[seconds % 4], transform: [{ scale }], fontWeight: seconds % 2 ? "900" : "600", fontFamily: seconds <= 60 && seconds % 3 === 0 ? Platform.OS === "ios" ? "Courier" : "monospace" : undefined }]}>{seconds <= 60 ? seconds : `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`}</Animated.Text>
        <Text style={[styles.body, { color: theme.textMuted }]}>{c.rules}</Text>
        <Text style={[styles.eligible, { color: theme.primary }]}>{c.eligible}: {Math.min(7, eligibleDays)}/7</Text>
      </View> : <>
        <YoutubePlayer videoId={event.youtubeId} />
        <Text style={[styles.caption, { color: theme.textMuted }]}>{c.stream}</Text>
        <View style={[styles.prize, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.eyebrow, { color: theme.primary }]}>{c.prize}</Text>
          <Text style={[styles.prizeText, { color: theme.text }]}>{round?.label}</Text>
          {round?.kind === "cash" ? <Text style={[styles.prizeText, { color: "#FFD95E" }]}>{formatMoney(round.cashUnits)}</Text> : null}
        </View>
        <PlayerReel players={round?.participants ?? []} winner={winner} spinning={round?.status === "spinning"} />
        <Text style={[styles.body, { color: theme.textMuted }]}>{round?.status === "spinning" ? c.spinning : round?.status === "finished" ? c.next : c.waiting}</Text>
        <Text style={[styles.caption, { color: theme.primary }]}>{c.participants}: {round?.participantCount ?? 0}</Text>
        <Text style={[styles.caption, { color: theme.textMuted }]}>{c.rules}</Text>
      </>}
    </ScrollView>
    <Modal visible={Boolean(winner && round && dismissed !== round.id)} transparent animationType="fade" onRequestClose={() => setDismissed(round?.id ?? null)}>
      <View style={styles.winOverlay}>
        <View style={[styles.winCard, { backgroundColor: theme.surface, borderColor: "#FFD95E" }]}>
          <Text style={[styles.heading, { color: "#FFD95E" }]}>{won ? c.youWon : c.winner}</Text>
          {winner ? <Avatar name={winner.name} avatarUrl={winner.avatarUrl} size={90} /> : null}
          <Text style={[styles.heading, { color: theme.text }]}>{winner?.name}</Text>
          <Text style={[styles.prizeText, { color: theme.primary }]}>{round?.label}</Text>
          {round?.kind === "cash" ? <Text style={[styles.heading, { color: "#FFD95E" }]}>{formatMoney(round.cashUnits)}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => setDismissed(round?.id ?? null)} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.onPrimary, fontWeight: "800" }}>{c.ok}</Text></Pressable>
        </View>
        {won ? <Fireworks /> : null}
      </View>
    </Modal>
  </SafeAreaView>;
}
function PlayerReel({ players, winner, spinning }: { players: RafflePlayer[]; winner: RafflePlayer | null; spinning: boolean }) {
  const theme = useAppTheme();
  const [travel] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(300);
  const count = players.length;
  useEffect(() => {
    if (!spinning || !count) return;
    travel.setValue(0);
    const animation = Animated.loop(Animated.timing(travel, { toValue: -count * 88, duration: count * 180, easing: Easing.linear, useNativeDriver: Platform.OS !== "web" }));
    animation.start(); return () => animation.stop();
  }, [count, spinning, travel]);
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.reel, { borderColor: theme.primary, backgroundColor: theme.surface, overflow: "hidden" }]}>
    <Text style={styles.pointer}>▼</Text>
    {winner ? <View style={{ alignItems: "center" }}><Avatar name={winner.name} avatarUrl={winner.avatarUrl} size={76}/><Text style={{color:theme.text,fontWeight:"700",marginTop:8}}>{winner.name}</Text></View> :
    <Animated.View style={{position:"absolute",left:(width-88)/2,flexDirection:"row",transform:[{translateX:travel}]}}>
      {[...players,...players].map((player,i)=><View key={`${player.id}:${i}`} style={{width:88,alignItems:"center",paddingHorizontal:4}}><Avatar name={player.name} avatarUrl={player.avatarUrl} size={64}/><Text numberOfLines={1} style={{color:theme.text,fontSize:11,marginTop:8}}>{player.name}</Text></View>)}
    </Animated.View>}
    {spinning ? <View style={[styles.reelLine, { backgroundColor: theme.primary }]} /> : null}
  </View>;
}
function Fireworks() {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => { const animation = Animated.loop(Animated.sequence([Animated.timing(progress, { toValue: 1, duration: 1600, useNativeDriver: Platform.OS !== "web" }), Animated.delay(200)]), { iterations: 3 }); animation.start(); return () => animation.stop(); }, [progress]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{Array.from({length:28},(_,i) => <Animated.View key={i} style={{ position:"absolute", top:"40%", left:"50%", width:7, height:12, borderRadius:3, backgroundColor:["#FFD95E","#4FE2B6","#FF719B"][i%3], opacity:progress.interpolate({inputRange:[0,.8,1],outputRange:[1,1,0]}), transform:[{translateX:progress.interpolate({inputRange:[0,1],outputRange:[0,Math.cos(i/28*Math.PI*2)*170]})},{translateY:progress.interpolate({inputRange:[0,1],outputRange:[0,Math.sin(i/28*Math.PI*2)*280]})},{rotate:`${i*23}deg`}] }} />)}</View>;
}
const styles = StyleSheet.create({
 screen:{flex:1},content:{padding:20,gap:12,alignItems:"center",flexGrow:1},eyebrow:{fontSize:12,fontWeight:"800",textAlign:"center",letterSpacing:1.2},heading:{fontSize:24,fontWeight:"900",textAlign:"center"},countdown:{flex:1,justifyContent:"center",alignItems:"center",gap:26,width:"100%",minHeight:400},digits:{fontSize:88,fontVariant:["tabular-nums"],textAlign:"center"},body:{fontSize:15,lineHeight:23,textAlign:"center"},eligible:{fontSize:16,fontWeight:"700"},caption:{fontSize:12,lineHeight:18,textAlign:"center"},prize:{width:"100%",padding:16,borderRadius:20,borderWidth:1,gap:6},prizeText:{fontSize:20,fontWeight:"800",textAlign:"center"},reel:{width:"100%",height:156,borderRadius:24,borderWidth:2,padding:12,alignItems:"center",justifyContent:"center"},pointer:{position:"absolute",top:-10,color:"#FFD95E",fontSize:24,zIndex:2},avatars:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:10},reelLine:{height:3,width:36,borderRadius:2,position:"absolute",bottom:8},winOverlay:{flex:1,justifyContent:"center",alignItems:"center",padding:24,backgroundColor:"rgba(0,12,8,.88)"},winCard:{width:"100%",maxWidth:380,borderRadius:30,borderWidth:2,padding:26,alignItems:"center",gap:18},button:{minHeight:50,borderRadius:999,width:"100%",alignItems:"center",justifyContent:"center",paddingHorizontal:20},
});
