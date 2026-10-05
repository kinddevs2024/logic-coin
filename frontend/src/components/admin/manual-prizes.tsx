import { useEffect, useState } from "react";
import { TextInput, View, StyleSheet } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { AdminDataState } from "@/components/admin/admin-ui";
import { useAdminSession } from "@/components/admin/admin-session";
import { useAppTheme } from "@/hooks/use-app-theme";
import { adminApi } from "@/lib/api";

function cents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  const [whole, fraction = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount <= 1_000_000_000 ? amount : NaN;
}
const money = (units: number) => `$${(units / 100).toFixed(2)}`;

export function ManualPrizes({ dayKey, onDirtyChange }: { dayKey: string; onDirtyChange: (dirty: boolean) => void }) {
  const theme = useAppTheme();
  const { adminToken } = useAdminSession();
  const client = useQueryClient();
  const [draft, setDraft] = useState<{ revision: number; amounts: Record<string, string> } | null>(null);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<"manual" | "automatic" | null>(null);
  const query = useQuery({ queryKey: ["admin", "prizes", dayKey], queryFn: () => adminApi.challengePrizes(dayKey, adminToken) });
  const data = query.data;
  const dirty = draft !== null;
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  const baseline = Object.fromEntries((data?.participants ?? []).map(row => [row.userId, (row.cashUnits / 100).toFixed(2)]));
  const amounts = draft?.amounts ?? baseline;
  const prizes = Object.entries(amounts).map(([userId, amount]) => ({ userId, cashUnits: cents(amount) }));
  const total = prizes.reduce((sum, row) => sum + row.cashUnits, 0);
  const valid = Number.isSafeInteger(total) && total >= 0 && total <= (data?.prizePoolUnits ?? 0);
  const save = useMutation({
    mutationFn: (mode: "manual" | "automatic") => adminApi.saveChallengePrizes(dayKey, { mode, revision: draft?.revision ?? data!.revision, prizes: mode === "manual" ? prizes : [] }, adminToken),
    onSuccess: (result) => {
      setDraft(null); setConfirm(null); setNotice("Назначения сохранены. Деньги будут доступны после подведения итогов.");
      client.setQueryData(["admin", "prizes", dayKey], result);
      void client.invalidateQueries({ queryKey: ["admin"] });
      void client.invalidateQueries({ queryKey: ["challenges"] });
    },
    onError: (error) => { setConfirm(null); setNotice(error instanceof Error ? error.message : "Не удалось сохранить призы"); },
  });
  const rows = (data?.participants ?? []).filter(row => `${row.name} ${row.userId} ${row.rank}`.toLowerCase().includes(search.toLowerCase()));
  return <View style={[styles.panel, { borderColor: theme.border }]}>
    <AppText variant="heading">Призы участников</AppText>
    <AdminDataState loading={query.isPending} error={query.error} onRetry={() => void query.refetch()} />
    {data ? <>
      <AppText muted>{data.locked ? "Итоги зафиксированы — изменение недоступно." : `Режим: ${data.mode === "manual" ? "ручной" : "автоматический"}. Суммы вводятся в долларах.`}</AppText>
      <AppText>Фонд {money(data.prizePoolUnits)} · Назначено {Number.isFinite(total) ? money(total) : "—"} · Остаток {Number.isFinite(total) ? money(data.prizePoolUnits - total) : "—"}</AppText>
      {!data.locked ? <AppText variant="caption" muted>Ручной режим заменяет автоматические денежные призы. 0 — без денежного приза; новые участники получат 0, пока админ не назначит сумму. Место и коины не изменяются.</AppText> : null}
      <TextInput accessibilityLabel="Найти участника" placeholder="Имя, место или ID" placeholderTextColor={String(theme.textMuted)} value={search} onChangeText={value => { setSearch(value); setLimit(20); }} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
      {rows.slice(0, limit).map(row => <View key={row.userId} style={[styles.row, { borderColor: theme.border }]}>
        <View style={{ flex: 1, minWidth: 0 }}><AppText variant="label">{row.rank}. {row.name}</AppText><AppText variant="caption" muted>{row.totalCoins} коинов · …{row.userId.slice(-6)}</AppText></View>
        <AppText>$</AppText>
        <TextInput accessibilityLabel={`Приз для ${row.name}, место ${row.rank}, USD`} editable={!data.locked && !save.isPending} keyboardType="decimal-pad" value={amounts[row.userId] ?? "0.00"} onChangeText={value => {
          setDraft(current => ({ revision: current?.revision ?? data.revision, amounts: { ...(current?.amounts ?? baseline), [row.userId]: value } }));
          setConfirm(null); setNotice("");
        }} style={[styles.input, styles.amount, { color: theme.text, borderColor: theme.border }]} />
      </View>)}
      {!rows.length ? <AppText muted>Участники не найдены.</AppText> : null}
      {rows.length > limit ? <AppButton variant="ghost" onPress={() => setLimit(value => value + 20)}>Ещё участники</AppButton> : null}
      {!valid ? <AppText color={String(theme.danger)}>Введите суммы с точностью до цента. Общая сумма не должна превышать фонд.</AppText> : null}
      {!data.locked ? <>
        <AppButton disabled={!valid || save.isPending || !data.participants.length} onPress={() => setConfirm("manual")}>Сохранить ручные призы</AppButton>
        <AppButton variant="ghost" disabled={save.isPending || (data.mode === "automatic" && !dirty)} onPress={() => setConfirm("automatic")}>Вернуть автоматический расчёт</AppButton>
        {dirty ? <AppButton variant="ghost" disabled={save.isPending} onPress={() => { setDraft(null); setConfirm(null); }}>Отменить несохранённые изменения</AppButton> : null}
        {confirm ? <View style={styles.confirm}>
          <AppText>{confirm === "manual" ? `Назначить денежные призы на ${money(total)}? Остаток не распределяется автоматически.` : "Удалить ручные назначения и вернуть автоматическое распределение?"}</AppText>
          <AppButton loading={save.isPending} onPress={() => save.mutate(confirm)}>Подтвердить назначения</AppButton>
          <AppButton variant="ghost" disabled={save.isPending} onPress={() => setConfirm(null)}>Отмена</AppButton>
        </View> : null}
      </> : null}
    </> : null}
    {notice ? <AppText accessibilityRole="alert">{notice}</AppText> : null}
  </View>;
}
const styles = StyleSheet.create({
  panel: { paddingTop: 20, marginTop: 16, borderTopWidth: 1, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 10, minHeight: 44 },
  amount: { width: 100 }, confirm: { gap: 10, paddingVertical: 12 },
});
