import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { useAdminSession } from "@/components/admin/admin-session";
import { AdminDataState, AdminPageHeader } from "@/components/admin/admin-ui";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { adminApi, type AdminWithdrawal } from "@/lib/api";

const labels: Record<string, string> = { pending_review: "На проверке", approved: "Одобрены", paid: "Выплачены", rejected: "Отклонены", sandbox_pending: "Старые тестовые", sandbox_completed: "Тестовые завершённые", all: "Все" };
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
type Action = "approve" | "reject" | "mark_paid";
const actions: Record<Action, string> = { approve: "Одобрить", reject: "Отклонить", mark_paid: "Отметить выплаченным" };

export default function AdminWithdrawalsScreen() {
  const { adminToken } = useAdminSession();
  const theme = useAppTheme();
  const client = useQueryClient();
  const [status, setStatus] = useState("pending_review");
  const [selected, setSelected] = useState<{ row: AdminWithdrawal; action: Action } | null>(null);
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["admin", "withdrawals", status, adminToken], initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => adminApi.withdrawals({ ...(status !== "all" ? { status } : {}), ...(pageParam ? { before: pageParam } : {}) }, adminToken),
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
  const review = useMutation({
    mutationFn: () => {
      if (!selected) throw Error("Выберите заявку");
      return adminApi.reviewWithdrawal(selected.row.id, { action: selected.action, expectedVersion: selected.row.reviewVersion, note,
        ...(selected.action === "mark_paid" ? { paymentReference: reference, paymentConfirmed: confirmed } : {}),
      }, adminToken);
    },
    onSuccess: () => { setSelected(null); setNotice("Заявка обновлена."); void client.invalidateQueries({ queryKey: ["admin", "withdrawals"] }); },
    onError: () => { void client.invalidateQueries({ queryKey: ["admin", "withdrawals"] }); },
  });
  const rows = [...new Map((query.data?.pages.flatMap(page => page.withdrawals) ?? []).map(row => [row.id, row])).values()];
  const summary = query.data?.pages[0]?.summary ?? [];
  const select = (row: AdminWithdrawal, action: Action) => { review.reset(); setNotice(""); setNote(""); setReference(""); setConfirmed(false); setSelected({ row, action }); };
  const disabled = review.isPending || !selected || (selected.action === "reject" && note.trim().length < 3) || (selected.action === "mark_paid" && (!confirmed || reference.trim().length < 3));
  const inputStyle = { borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, color: theme.text, minHeight: 46 };
  return <View style={{ gap: 16 }}>
    <AdminPageHeader title="Заявки на вывод" description="Проверка заявок и учёт выплат. Банковский перевод выполняется отдельно." />
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {Object.entries(labels).map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: status === value }} disabled={review.isPending || Boolean(selected)} onPress={() => { setStatus(value); setNotice(""); }} style={{ padding: 10, borderRadius: 14, backgroundColor: status === value ? theme.primarySoft : theme.surfaceRaised }}>
        <AppText variant="caption">{label}{value !== "all" ? ` (${summary.find(row => row.status === value)?.count ?? 0})` : ""}</AppText>
      </Pressable>)}
    </View>
    <AppButton variant="ghost" disabled={query.isFetching || review.isPending} onPress={() => void query.refetch()}>Обновить список</AppButton>
    {notice ? <AppText accessibilityRole="alert">{notice}</AppText> : null}
    <AdminDataState loading={query.isPending} error={query.error} empty={!query.isPending && !query.error && !rows.length} emptyText="Заявок в этом разделе нет" onRetry={() => void query.refetch()} />
    <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => { if (!review.isPending) { setSelected(null); review.reset(); } }}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 }}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: "90%", width: "100%", maxWidth: 560 }}>
    {selected ? <GlassSurface variant="strong" style={{ padding: 20, borderRadius: 24, gap: 12, backgroundColor: theme.surfaceRaised }}>
      <AppText variant="heading">{actions[selected.action]}: {money(selected.row.amountCents)}</AppText>
      <AppText>{selected.row.user.name} · {selected.row.accountLabel ?? "Банковская карта"}</AppText>
      <AppText variant="caption" muted>Заявка {selected.row.id}</AppText>
      <AppText muted>{selected.action === "approve" ? "Сумма останется в резерве до выплаты или отклонения." : selected.action === "reject" ? "Зарезервированная сумма вернётся пользователю. Это действие нельзя отменить." : "Это только отметка о сделанном переводе, а не отправка денег. После подтверждения резерв будет списан."}</AppText>
      <TextInput accessibilityLabel={selected.action === "reject" ? "Причина отклонения" : "Комментарий администратора"} placeholder={selected.action === "reject" ? "Причина отклонения (обязательно)" : "Комментарий (необязательно)"} placeholderTextColor={String(theme.textMuted)} value={note} onChangeText={setNote} editable={!review.isPending} maxLength={400} multiline style={inputStyle} />
      {selected.action === "mark_paid" ? <>
        <TextInput accessibilityLabel="Номер выполненной операции" placeholder="Номер операции перевода" placeholderTextColor={String(theme.textMuted)} value={reference} onChangeText={setReference} maxLength={160} editable={!review.isPending} style={inputStyle} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} disabled={review.isPending} onPress={() => setConfirmed(value => !value)} style={{ paddingVertical: 12 }}><AppText>{confirmed ? "☑" : "☐"} Подтверждаю: деньги уже переведены получателю</AppText></Pressable>
      </> : null}
      {review.error ? <AppText accessibilityRole="alert" color={String(theme.danger)}>{review.error.message}</AppText> : null}
      <AppButton disabled={disabled} loading={review.isPending} onPress={() => review.mutate()}>Подтвердить</AppButton>
      <AppButton variant="ghost" disabled={review.isPending} onPress={() => { setSelected(null); review.reset(); }}>Отмена</AppButton>
    </GlassSurface> : null}
      </ScrollView></View>
    </Modal>
    {rows.map(row => <GlassSurface key={row.id} variant="strong" style={{ padding: 20, borderRadius: 24, gap: 9 }}>
      <AppText variant="heading">{money(row.amountCents)} · {labels[row.status] ?? row.status}</AppText>
      <AppText variant="label">{row.user.name}</AppText>
      <AppText variant="caption" muted>{row.user.email ?? row.user.id}{row.user.referralCode ? ` · ${row.user.referralCode}` : ""}</AppText>
      <AppText>{row.accountLabel ?? "Карта не указана"}{row.cardHolder ? ` · ${row.cardHolder}` : ""}</AppText>
      <AppText variant="caption" muted>{new Date(row.requestedAt).toLocaleString()} · {row.id}</AppText>
      {row.reviewNote ? <AppText variant="caption">Комментарий: {row.reviewNote}</AppText> : null}
      {row.paymentReference ? <AppText variant="caption">Операция: {row.paymentReference}</AppText> : null}
      {row.processedAt ? <AppText variant="caption" muted>Обработана: {new Date(row.processedAt).toLocaleString()}</AppText> : null}
      {row.reviewHistory.map((event, index) => <AppText key={index} variant="caption" muted>{new Date(event.at).toLocaleString()} · {actions[event.action as Action] ?? event.action} · админ …{event.adminId.slice(-6)}</AppText>)}
      {row.method === "bank_card" && ["pending_review", "approved"].includes(row.status) ? <>
        <AppText variant="caption" muted>Сохранены только последние 4 цифры карты. Полные платёжные реквизиты здесь недоступны.</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {row.status === "pending_review" ? <AppButton disabled={Boolean(selected)} onPress={() => select(row, "approve")}>Одобрить</AppButton> : <AppButton disabled={Boolean(selected)} onPress={() => select(row, "mark_paid")}>Отметить выплаченным</AppButton>}
          <AppButton variant="ghost" disabled={Boolean(selected)} onPress={() => select(row, "reject")}>Отклонить</AppButton>
        </View>
      </> : null}
    </GlassSurface>)}
    {query.hasNextPage ? <AppButton variant="ghost" loading={query.isFetchingNextPage} disabled={query.isFetching || Boolean(selected)} onPress={() => void query.fetchNextPage()}>Ещё заявки</AppButton> : null}
  </View>;
}
