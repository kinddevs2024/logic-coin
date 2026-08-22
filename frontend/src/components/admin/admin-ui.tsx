import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function AdminPageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageTitleWrap}>
        <AppText variant="title">{title}</AppText>
        <AppText muted>{description}</AppText>
      </View>
      {action}
    </View>
  );
}

export function AdminMetricCard({ label, value, icon, tone = "primary", detail }: { label: string; value: string; icon: IconName; tone?: "primary" | "success" | "warning" | "danger"; detail?: string }) {
  const theme = useAppTheme();
  const color = tone === "success" ? theme.success : tone === "warning" ? theme.warning : tone === "danger" ? theme.danger : theme.primary;
  return (
    <GlassSurface style={styles.metricCard} intensity={64}>
      <View style={[styles.metricIcon, { backgroundColor: `${String(color)}15` }]}><Ionicons name={icon} size={19} color={String(color)} /></View>
      <AppText style={styles.metricValue}>{value}</AppText>
      <AppText variant="caption" muted>{label}</AppText>
      {detail ? <AppText style={[styles.metricDetail, { color }]}>{detail}</AppText> : null}
    </GlassSurface>
  );
}

export function AdminDataState({ loading, error, empty, emptyText = "Данных пока нет", onRetry }: { loading?: boolean; error?: unknown; empty?: boolean; emptyText?: string; onRetry?: () => void }) {
  const theme = useAppTheme();
  if (loading) {
    return <View style={styles.state}><ActivityIndicator color={String(theme.primary)} /><AppText muted>Загружаем данные</AppText></View>;
  }
  if (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить данные";
    return (
      <View style={styles.state}>
        <Ionicons name="cloud-offline-outline" size={27} color={String(theme.danger)} />
        <AppText variant="label">Данные недоступны</AppText>
        <AppText variant="caption" muted style={styles.stateCopy}>{message}</AppText>
        {onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.retry, { backgroundColor: theme.primarySoft }]}><Ionicons name="refresh" size={17} color={String(theme.primary)} /><AppText variant="caption" color={String(theme.primary)}>Повторить</AppText></Pressable> : null}
      </View>
    );
  }
  if (empty) {
    return <View style={styles.state}><Ionicons name="file-tray-outline" size={27} color={String(theme.textMuted)} /><AppText variant="label">{emptyText}</AppText></View>;
  }
  return null;
}

export function AdminBarChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const theme = useAppTheme();
  const max = Math.max(1, ...values.map((value) => Math.abs(value)));
  return (
    <View style={styles.chart} accessibilityLabel="График динамики">
      {values.map((value, index) => (
        <View key={`${labels[index] ?? index}-${index}`} style={styles.chartColumn}>
          <View style={styles.barTrack}>
            <View style={[styles.bar, { backgroundColor: color, height: `${Math.max(value === 0 ? 3 : 10, Math.round((Math.abs(value) / max) * 100))}%` }]} />
          </View>
          <AppText style={[styles.chartLabel, { color: theme.textMuted }]}>{labels[index]}</AppText>
        </View>
      ))}
    </View>
  );
}

export function formatUnits(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

const styles = StyleSheet.create({
  pageHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  pageTitleWrap: { flex: 1, minWidth: 0, gap: 3 },
  metricCard: { flex: 1, minWidth: 150, minHeight: 142, borderRadius: 24, padding: 15, gap: 4 },
  metricIcon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  metricValue: { fontSize: 23, lineHeight: 28, fontWeight: "900", letterSpacing: -0.5 },
  metricDetail: { fontSize: 10, lineHeight: 13, fontWeight: "800", marginTop: 3 },
  state: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 24 },
  stateCopy: { textAlign: "center", maxWidth: 420 },
  retry: { minHeight: 38, borderRadius: 19, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4 },
  chart: { height: 190, flexDirection: "row", alignItems: "flex-end", gap: 7, paddingTop: 14 },
  chartColumn: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 7 },
  barTrack: { flex: 1, width: "100%", maxWidth: 34, justifyContent: "flex-end", borderRadius: 9, backgroundColor: "rgba(115,145,174,0.09)", overflow: "hidden" },
  bar: { width: "100%", minHeight: 3, borderRadius: 9 },
  chartLabel: { fontSize: 9, lineHeight: 11, fontWeight: "700" },
});
