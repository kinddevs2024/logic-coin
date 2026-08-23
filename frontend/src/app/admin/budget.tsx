import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

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
  const queryClient = useQueryClient();
  const { adminToken } = useAdminSession();
  const { summary, daily } = budget;
  const chartDaily = daily.slice(-14);
  const [adjusting, setAdjusting] = useState(false);
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const amountUnits = Number(amount);
  const validAdjustment = Number.isInteger(amountUnits) && amountUnits > 0 && note.trim().length > 0;
  const adjust = useMutation({
    mutationFn: () => adminApi.adjustBudget({ direction, amountUnits, note: note.trim() }, adminToken),
    onSuccess: () => {
      setNotice(direction === "credit" ? "Бюджет пополнен." : "Сумма списана из бюджета.");
      setAmount("");
      setNote("");
      setAdjusting(false);
      void queryClient.invalidateQueries({ queryKey: ["admin", "budget"] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Не удалось изменить бюджет"),
  });

  return (
    <>
      <View style={styles.metrics}>
        <AdminMetricCard label="Доход от рекламы" value={`${formatUnits(summary.adRevenueUnits)} LC`} icon="megaphone-outline" tone="success" />
        <AdminMetricCard label="Расход на челленджи" value={`${formatUnits(summary.challengeSpendUnits)} LC`} icon="trophy-outline" tone="warning" />
        <AdminMetricCard label="Чистый результат" value={`${formatUnits(summary.netUnits)} LC`} icon="trending-up-outline" tone={summary.netUnits >= 0 ? "success" : "danger"} />
        <AdminMetricCard label="ARPU" value={`${formatUnits(summary.arpuUnits)} LC`} icon="person-outline" />
        <AdminMetricCard label="Доход в день" value={`${formatUnits(summary.averageDailyRevenueUnits)} LC`} icon="calendar-outline" />
        <GlassSurface style={styles.balanceMetric} intensity={68}>
          <View style={styles.balanceMetricTop}>
            <View style={[styles.balanceMetricIcon, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="wallet-outline" size={19} color={String(theme.primary)} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Изменить общий бюджет" onPress={() => setAdjusting(true)} style={({ pressed }) => [styles.editBudget, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }, pressed && styles.pressed]}>
              <Ionicons name="create-outline" size={17} color={String(theme.primary)} />
            </Pressable>
          </View>
          <AppText style={[styles.balanceMetricValue, { color: summary.platformBalanceUnits < 0 ? theme.danger : theme.text }]}>{formatUnits(summary.platformBalanceUnits)} LC</AppText>
          <AppText variant="caption" muted>Общий бюджет</AppText>
          <AppText style={[styles.balanceHint, { color: summary.platformBalanceUnits < 0 ? theme.danger : theme.success }]}>{summary.platformBalanceUnits < 0 ? "Бюджет в минусе" : "Доступно платформе"}</AppText>
        </GlassSurface>
      </View>

      {notice ? <View style={[styles.notice, { backgroundColor: theme.primarySoft }]}><Ionicons name="information-circle-outline" size={17} color={String(theme.primary)} /><AppText variant="caption" style={styles.noticeText}>{notice}</AppText></View> : null}

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

      <Modal visible={adjusting} transparent animationType="fade" onRequestClose={() => setAdjusting(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAdjusting(false)}>
          <Pressable style={styles.modalStop} onPress={() => undefined}>
            <GlassSurface variant="strong" intensity={88} style={styles.adjustmentSheet}>
              <View style={styles.sheetHeader}>
                <View><AppText variant="heading">Изменить бюджет</AppText><AppText variant="caption" muted>Баланс может уходить в минус</AppText></View>
                <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={() => setAdjusting(false)} style={[styles.closeButton, { backgroundColor: theme.surfaceRaised }]}><Ionicons name="close" size={20} color={String(theme.text)} /></Pressable>
              </View>
              <View style={[styles.direction, { borderColor: theme.border }]}>
                {(["credit", "debit"] as const).map((item) => {
                  const active = direction === item;
                  return <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setDirection(item)} style={[styles.directionItem, active && { backgroundColor: item === "credit" ? theme.success : theme.danger }]}><Ionicons name={item === "credit" ? "add-circle-outline" : "remove-circle-outline"} size={18} color={active ? "#FFFFFF" : String(theme.textMuted)} /><AppText variant="caption" color={active ? "#FFFFFF" : String(theme.textMuted)}>{item === "credit" ? "Добавить" : "Убавить"}</AppText></Pressable>;
                })}
              </View>
              <View style={styles.adjustmentField}><AppText variant="caption" muted>Сумма, LC</AppText><TextInput value={amount} onChangeText={(value) => setAmount(value.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="0" placeholderTextColor={String(theme.textMuted)} style={[styles.adjustmentInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]} /></View>
              <View style={styles.adjustmentField}><AppText variant="caption" muted>Комментарий</AppText><TextInput value={note} onChangeText={setNote} placeholder="Например, пополнение учредителя" placeholderTextColor={String(theme.textMuted)} maxLength={240} style={[styles.adjustmentInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]} /></View>
              <Pressable accessibilityRole="button" disabled={!validAdjustment || adjust.isPending} onPress={() => adjust.mutate()} style={({ pressed }) => [styles.submitAdjustment, { backgroundColor: direction === "credit" ? theme.success : theme.danger }, (!validAdjustment || adjust.isPending) && styles.disabled, pressed && styles.pressed]}><Ionicons name={direction === "credit" ? "add" : "remove"} size={20} color="#FFFFFF" /><AppText variant="label" color="#FFFFFF">{adjust.isPending ? "Сохраняем…" : direction === "credit" ? "Добавить к бюджету" : "Вычесть из бюджета"}</AppText></Pressable>
            </GlassSurface>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: { gap: 16 },
  range: { minHeight: 42, borderRadius: 21, borderWidth: 1, padding: 3, flexDirection: "row", backgroundColor: "rgba(255,255,255,0.25)" },
  rangeItem: { minWidth: 43, minHeight: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  balanceMetric: { flex: 1, minWidth: 150, minHeight: 142, borderRadius: 24, padding: 15, gap: 4 },
  balanceMetricTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  balanceMetricIcon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  editBudget: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  balanceMetricValue: { fontSize: 23, lineHeight: 28, fontWeight: "900", letterSpacing: -0.5 },
  balanceHint: { fontSize: 10, lineHeight: 13, fontWeight: "800", marginTop: 3 },
  notice: { minHeight: 42, borderRadius: 15, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeText: { flex: 1 },
  chartPanel: { borderRadius: 28, padding: 17 },
  tablePanel: { borderRadius: 28, padding: 17, gap: 13 },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  table: { minWidth: 680 },
  row: { minHeight: 48, borderBottomWidth: 1, flexDirection: "row", alignItems: "center" },
  headerRow: { minHeight: 40 },
  cellHeader: { fontSize: 10, lineHeight: 13, fontWeight: "900", opacity: 0.65, textTransform: "uppercase" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(8,19,37,0.34)" },
  modalStop: { width: "100%", alignItems: "center" },
  adjustmentSheet: { width: "100%", maxWidth: 560, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 20, paddingBottom: 30, gap: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  direction: { minHeight: 50, borderRadius: 18, borderWidth: 1, padding: 3, flexDirection: "row" },
  directionItem: { flex: 1, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  adjustmentField: { gap: 7 },
  adjustmentInput: { minHeight: 52, borderRadius: 17, borderWidth: 1, paddingHorizontal: 14, fontSize: 16, fontWeight: "800", outlineStyle: "none" } as never,
  submitAdjustment: { minHeight: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
});
