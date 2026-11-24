import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { AdminDataState, AdminPageHeader } from "@/components/admin/admin-ui";
import { useAppTheme } from "@/hooks/use-app-theme";
import { adminApi, ownerApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";

function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function CreditsReport({ token, owner = false }: { token: string; owner?: boolean }) {
  const theme = useAppTheme();
  const today = new Date().toISOString().slice(0, 10);
  const [day, setDay] = useState(today);
  const [dateInput, setDateInput] = useState(today);
  const date = new Date(`${dateInput}T12:00:00Z`);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(dateInput) && Number.isFinite(+date)
    && date.toISOString().slice(0, 10) === dateInput && dateInput <= today;
  const selectDay = (value: string) => {
    setDay(value);
    setDateInput(value);
  };
  const query = useQuery({
    queryKey: ["credits-report", owner, token, day],
    queryFn: () => (owner ? ownerApi : adminApi).overview(day, token),
    enabled: Boolean(token),
    staleTime: 30_000
  });
  const data = query.data;
  const breakdown = data?.moneyIssuedBySource;

  const row = (label: string, amount: number, total = false) => (
    <View style={[styles.row, styles.divider, { borderColor: theme.border }]}>
      <AppText style={styles.label} variant={total ? "label" : "body"}>{label}</AppText>
      <AppText variant="label">{formatMoney(amount)}</AppText>
    </View>
  );
  const button = (label: string, onPress: () => void, disabled = false) => (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={[styles.button, { backgroundColor: theme.primarySoft, opacity: disabled ? 0.5 : 1 }]}>
      <AppText variant="label">{label}</AppText>
    </Pressable>
  );

  return (
    <View style={styles.page}>
      <AdminPageHeader title="Денежные начисления" description="Призовой фонд челленджа и начисления в кошельки за выбранный день." />
      <View style={styles.controls}>
        {button("Предыдущий день", () => selectDay(shiftDay(day, -1)))}
        <TextInput accessibilityLabel="Дата отчёта" value={dateInput} onChangeText={setDateInput}
          maxLength={10} placeholder="ГГГГ-ММ-ДД" onSubmitEditing={() => { if (valid) selectDay(dateInput); }}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]} />
        {button("Открыть", () => selectDay(dateInput), !valid)}
        {button("Следующий день", () => selectDay(shiftDay(day, 1)), day >= today)}
      </View>
      <AdminDataState loading={query.isPending} error={query.error} onRetry={() => void query.refetch()} />
      {data ? (
        <>
          <AppText muted>{data.dayKey} · Часовой пояс отчёта {data.timezone}</AppText>
          <GlassSurface style={styles.panel}>
            <AppText variant="heading">Дневной челлендж</AppText>
            {data.challenge ? row("Призовой фонд", data.challenge.prizePoolUnits) : <AppText muted>Челлендж за этот день не найден.</AppText>}
            {data.settlement?.status === "settled" ? row("Распределено игрокам", data.settlement.cashDistributedUnits)
              : data.challenge ? <AppText muted>Итоги ещё не подведены.</AppText> : null}
          </GlassSurface>
          <GlassSurface style={styles.panel}>
            <AppText variant="heading">Начислено в кошельки</AppText>
            <AppText muted>По дате получения. Здесь могут быть призы за прошлые челленджи.</AppText>
            {breakdown ? (
              <>
                {row("Призы за челленджи", breakdown.challengePrizes)}
                {row("Призы за розыгрыши", breakdown.rafflePrizes)}
                {row("Реферальные бонусы", breakdown.referralBonuses)}
                {row("Прочие начисления", breakdown.other)}
              </>
            ) : <AppText muted>Разбивка начислений сейчас недоступна.</AppText>}
            {row("Всего начислено", data.moneyIssuedUnits, true)}
          </GlassSurface>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 16, width: "100%", maxWidth: 840 },
  controls: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  button: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, minHeight: 42, justifyContent: "center" },
  input: { paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, minHeight: 42, minWidth: 120 },
  panel: { padding: 18, gap: 8, borderRadius: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 10 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
  label: { flexShrink: 1 }
});
