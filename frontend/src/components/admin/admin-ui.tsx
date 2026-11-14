import { AdminPressable as Pressable } from "@/components/admin/admin-primitives";
import { useUiCopy } from "@/components/localized-native";
import { useAppStore } from "@/store/app-store";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, type ReactNode } from "react";
import {ActivityIndicator, Modal,  StyleSheet, useWindowDimensions, View} from "react-native";

import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function AdminPageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  const { copyContent } = useUiCopy();
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageTitleWrap}>
        <AppText variant="title">{copyContent(title)}</AppText>

      </View>
      {action}
    </View>
  );
}

export function AdminMetricCard({ label, value, icon = "stats-chart-outline", tone = "primary", detail, explanation, compact = false }: { label: string; value: string; icon?: IconName; tone?: "primary" | "success" | "warning" | "danger"; detail?: ReactNode; explanation?: string; compact?: boolean }) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const color = tone === "success" ? theme.success : tone === "warning" ? theme.warning : tone === "danger" ? theme.danger : theme.primary;
  return (
    <GlassSurface style={[styles.metricCard, compact && [styles.metricCompact, { minWidth: width >= 1024 ? 0 : 130 }]]} intensity={64}>
      {!compact && <View style={[styles.metricIcon, { backgroundColor: `${String(color)}15` }]}><Ionicons name={icon} size={19} color={String(color)} /></View>}
      <AppText style={styles.metricValue}>{value}</AppText>
      {explanation ? <Pressable accessibilityRole="button" accessibilityLabel={`${label}: пояснение`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.metricLabel}>
        <AppText variant="caption" muted style={{ flexShrink: 1 }}>{label}</AppText>
        <Ionicons name="information-circle-outline" size={16} color={String(theme.textMuted)} />
      </Pressable> : <AppText variant="caption" muted>{label}</AppText>}
      {explanation ? <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
        <View style={styles.helpBackdrop}>
          <View accessibilityViewIsModal style={[styles.helpPanel, { backgroundColor: theme.surfaceRaised }]}>
            <AppText variant="heading">{label}</AppText>
            <AppText>{explanation}</AppText>
            <Pressable accessibilityRole="button" onPress={() => setExpanded(false)} style={[styles.retry, { backgroundColor: theme.primarySoft }]}><AppText variant="label">Понятно</AppText></Pressable>
          </View>
        </View>
      </Modal> : null}
      {detail ? <AppText style={[styles.metricDetail, { color }]}>{detail}</AppText> : null}
    </GlassSurface>
  );
}

export function AdminDataState({ loading, error, empty, emptyText = "Данных пока нет", onRetry }: { loading?: boolean; error?: unknown; empty?: boolean; emptyText?: string; onRetry?: () => void }) {
  const { copyText, copyContent } = useUiCopy();
  const theme = useAppTheme();
  if (loading) {
    return <View style={styles.state}><ActivityIndicator color={String(theme.primary)} /><AppText muted>{copyText("Загружаем данные")}</AppText></View>;
  }
  if (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить данные";
    return (
      <View style={styles.state}>
        <Ionicons name="cloud-offline-outline" size={27} color={String(theme.danger)} />
        <AppText variant="label">{copyText("Данные недоступны")}</AppText>
        <AppText variant="caption" muted style={styles.stateCopy}>{copyContent(message)}</AppText>
        {onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.retry, { backgroundColor: theme.primarySoft }]}><Ionicons name="refresh" size={17} color={String(theme.primary)} /><AppText variant="caption" color={String(theme.primary)}>{copyText("Повторить")}</AppText></Pressable> : null}
      </View>
    );
  }
  if (empty) {
    return <View style={styles.state}><Ionicons name="file-tray-outline" size={27} color={String(theme.textMuted)} /><AppText variant="label">{copyContent(emptyText)}</AppText></View>;
  }
  return null;
}

export function AdminBarChart({values,labels,color}:{values:number[];labels:string[];color:string}) {
 const theme=useAppTheme();const [selected,setSelected]=useState<number|null>(null);
 const max=Math.max(1,...values),min=Math.min(0,...values),range=max-min,zero=(0-min)/range*180;
 return <View style={{marginTop:20,gap:10}}>
 <View style={{flexDirection:"row",height:210,gap:7}}>
  <View style={{width:42,height:180,justifyContent:"space-between"}}>{[0,1,2,3,4].map(i=><AppText key={i} variant="caption" muted style={{fontSize:10,textAlign:"right"}}>{formatUnits(max-range*i/4)}</AppText>)}</View>
  <View style={{flex:1,height:210}}>
   {[0,1,2,3,4].map(i=><View key={i} style={{position:"absolute",left:0,right:0,top:i*45,borderTopWidth:1,borderColor:theme.border}}/>)}
   <View style={{height:210,flexDirection:"row",gap:3}}>{values.map((value,index)=>{
    const h=Math.abs(value)/range*180;
    return <Pressable key={index} accessibilityRole="button" accessibilityLabel={`${labels[index]}: ${formatUnits(value)}`} onPress={()=>setSelected(index)} style={{flex:1,height:210}}>
     <View style={{height:180,position:"relative"}}><View style={{position:"absolute",bottom:value>=0?zero:zero-h,left:2,right:2,height:h,backgroundColor:color,borderRadius:3,opacity:selected===null||selected===index?1:0.4}}/></View>
     <AppText muted variant="caption" style={{fontSize:10,textAlign:"center",marginTop:7}}>{index%Math.max(1,Math.ceil(labels.length/7))===0?labels[index]:""}</AppText>
    </Pressable>;
   })}</View>
  </View>
 </View>
 <AppText variant="caption" muted>{selected===null?"Нажмите на столбец, чтобы увидеть значение":`${labels[selected]}: ${formatUnits(values[selected])}`}</AppText>
 </View>;
}

export function formatUnits(value: number) {
  return new Intl.NumberFormat(useAppStore.getState().language ?? "uz", { maximumFractionDigits: 2 }).format(value);
}

const styles = StyleSheet.create({
  pageHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  pageTitleWrap: { flex: 1, minWidth: 0, gap: 3 },
  metricCard: { flex: 1, minWidth: 150, minHeight: 142, borderRadius: 24, padding: 15, gap: 4 },
  metricCompact: { minWidth: 0, flexBasis: 0, minHeight: 110, padding: 11, borderRadius: 20 },
  helpBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  helpPanel: { width: "100%", maxWidth: 480, borderRadius: 24, padding: 24, gap: 16 },
  metricLabel: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  metricIcon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  metricValue: { fontSize: 23, lineHeight: 28, fontWeight: "900", letterSpacing: -0.5 },
  metricDetail: { fontSize: 10, lineHeight: 13, fontWeight: "800", marginTop: 3 },
  state: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 24 },
  stateCopy: { textAlign: "center", maxWidth: 420 },
  retry: { minHeight: 38, borderRadius: 19, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4 },
  chart: { height: 190, flexDirection: "row", alignItems: "flex-end", gap: 7, paddingTop: 14 },
  chartColumn: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 7 },
  barTrack: { flex: 1, width: "100%", maxWidth: 34, justifyContent: "flex-end", borderRadius: 9, backgroundColor: "rgba(82,108,92,0.09)", overflow: "hidden" },
  bar: { width: "100%", minHeight: 3, borderRadius: 9 },
  chartLabel: { fontSize: 9, lineHeight: 11, fontWeight: "700" },
});
