import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { AdminBarChart, AdminDataState, AdminMetricCard, AdminPageHeader, formatUnits } from "@/components/admin/admin-ui";
import { useAdminSession } from "@/components/admin/admin-session";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { adminApi } from "@/lib/api";

const RANGE_OPTIONS = [7, 30, 90] as const;

export default function AdminBudgetScreen() {
  const theme = useAppTheme();
  const { adminToken } = useAdminSession();
  const [days, setDays] = useState<(typeof RANGE_OPTIONS)[number]>(30);
  const budgetQuery = useQuery({
    queryKey: ["admin", "budget", days],
    queryFn: () => adminApi.budget(days, adminToken),
  });

  return (
    <View style={styles.page}>
      <AdminPageHeader
        title="Бюджет"
        description="Фактические доходы, расходы и рост"
        action={
          <View style={[styles.range, { borderColor: theme.border }]}>
            {RANGE_OPTIONS.map((option) => (
              <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: days === option }} onPress={() => setDays(option)} style={[styles.rangeItem, days === option && { backgroundColor: theme.primary }]}>
                <AppText variant="caption" color={days === option ? "#FFFFFF" : String(theme.textMuted)}>{option}д</AppText>
              </Pressable>
            ))}
          </View>
        }
      />

      <AdminDataState loading={budgetQuery.isPending} error={budgetQuery.error} onRetry={() => void budgetQuery.refetch()} />
      {budgetQuery.data ? <BudgetContent budget={budgetQuery.data} /> : null}
    </View>
  );
}

function BudgetContent({ budget }: { budget: Awaited<ReturnType<typeof adminApi.budget>> }) {
  const theme = useAppTheme();
  const { summary, daily } = budget;
  const growthTone = summary.growthPercent === null ? "primary" : summary.growthPercent >= 0 ? "success" : "danger";
  const growthLabel = summary.growthPercent === null ? "Нет прошлого периода" : `${summary.growthPercent >= 0 ? "+" : ""}${formatUnits(summary.growthPercent)}%`;
  const chartDaily = daily.slice(-14);

  return (
    <>
      <View style={styles.metrics}>
        <AdminMetricCard label="Доход от рекламы" value={`${formatUnits(summary.adRevenueUnits)} LC`} icon="megaphone-outline" tone="success" />
        <AdminMetricCard label="Расход на челленджи" value={`${formatUnits(summary.challengeSpendUnits)} LC`} icon="trophy-outline" tone="warning" />
        <AdminMetricCard label="Чистый результат" value={`${formatUnits(summary.netUnits)} LC`} icon="trending-up-outline" tone={summary.netUnits >= 0 ? "success" : "danger"} />
        <AdminMetricCard label="ARPU" value={`${formatUnits(summary.arpuUnits)} LC`} icon="person-outline" />
        <AdminMetricCard label="Доход в день" value={`${formatUnits(summary.averageDailyRevenueUnits)} LC`} icon="calendar-outline" />
        <AdminMetricCard label="Рост" value={growthLabel} icon={summary.growthPercent !== null && summary.growthPercent < 0 ? "trending-down-outline" : "trending-up-outline"} tone={growthTone} detail={`${formatUnits(summary.activeUsers)} активных пользователей`} />
      </View>

      <GlassSurface intensity={72} variant="strong" style={styles.chartPanel}>
        <View style={styles.panelHeader}>
          <View>
            <AppText variant="heading">Доход по дням</AppText>
            <AppText variant="caption" muted>{budget.range.from} — {budget.range.to}</AppText>
          </View>
          <View style={styles.legend}><View style={[styles.legendDot, { backgroundColor: theme.success }]} /><AppText variant="caption" muted>Реклама</AppText></View>
        </View>
        <AdminDataState empty={chartDaily.length === 0} emptyText="Доходы ещё не записаны" />
        {chartDaily.length ? <AdminBarChart values={chartDaily.map((entry) => entry.adRevenueUnits)} labels={chartDaily.map((entry) => entry.dayKey.slice(8, 10))} color={String(theme.success)} /> : null}
      </GlassSurface>

      <GlassSurface intensity={68} variant="strong" style={styles.tablePanel}>
        <View style={styles.panelHeader}><AppText variant="heading">Детализация</AppText><AppText variant="caption" muted>{daily.length} дней</AppText></View>
        <AdminDataState empty={daily.length === 0} emptyText="Операций за период нет" />
        {daily.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.table}>
              <View style={[styles.row, styles.headerRow, { borderBottomColor: theme.border }]}>
                {[["Дата", 108], ["Реклама", 112], ["Другой доход", 118], ["Операционные", 118], ["Челленджи", 112], ["Итого", 112]].map(([label, width]) => <AppText key={String(label)} style={[styles.cellHeader, { width: Number(width) }]}>{String(label)}</AppText>)}
              </View>
              {[...daily].reverse().map((entry) => (
                <View key={entry.dayKey} style={[styles.row, { borderBottomColor: theme.border }]}>
                  <AppText variant="caption" style={{ width: 108 }}>{entry.dayKey}</AppText>
                  <AppText variant="caption" color={String(theme.success)} style={{ width: 112, fontWeight: "800" }}>+{formatUnits(entry.adRevenueUnits)}</AppText>
                  <AppText variant="caption" color={String(theme.success)} style={{ width: 118, fontWeight: "800" }}>+{formatUnits(entry.otherRevenueUnits)}</AppText>
                  <AppText variant="caption" color={String(theme.danger)} style={{ width: 118, fontWeight: "800" }}>−{formatUnits(entry.operatingExpenseUnits)}</AppText>
                  <AppText variant="caption" color={String(theme.warning)} style={{ width: 112, fontWeight: "800" }}>−{formatUnits(entry.challengeSpendUnits)}</AppText>
                  <AppText variant="caption" color={String(entry.netUnits >= 0 ? theme.success : theme.danger)} style={{ width: 112, fontWeight: "900" }}>{entry.netUnits >= 0 ? "+" : ""}{formatUnits(entry.netUnits)}</AppText>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : null}
      </GlassSurface>
    </>
  );
}

const styles = StyleSheet.create({
  page: { gap: 16 },
  range: { minHeight: 42, borderRadius: 21, borderWidth: 1, padding: 3, flexDirection: "row", backgroundColor: "rgba(255,255,255,0.25)" },
  rangeItem: { minWidth: 43, minHeight: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  chartPanel: { borderRadius: 28, padding: 17 },
  tablePanel: { borderRadius: 28, padding: 17, gap: 13 },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  table: { minWidth: 680 },
  row: { minHeight: 48, borderBottomWidth: 1, flexDirection: "row", alignItems: "center" },
  headerRow: { minHeight: 40 },
  cellHeader: { fontSize: 10, lineHeight: 13, fontWeight: "900", opacity: 0.65, textTransform: "uppercase" },
});
