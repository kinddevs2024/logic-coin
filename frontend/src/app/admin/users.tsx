import { AdminPressable as Pressable } from "@/components/admin/admin-primitives";
import { CopyTextInput as TextInput, useUiCopy } from "@/components/localized-native";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Modal, ScrollView, View } from "react-native";

import { RoleBadge } from "@/components/role-badge";
import { adminApi, type AdminUser } from "@/lib/api";
import { useAdminSession } from "@/components/admin/admin-session";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { AdminUserEditor } from "@/components/admin/admin-user-editor";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function AdminUsersScreen() {
  const { copyText, copyContent, formatCopy } = useUiCopy();
  const { adminToken } = useAdminSession();
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const [gridWidth, setGridWidth] = useState(0);
  const columns = gridWidth >= 900 ? 6 : gridWidth >= 650 ? 4 : gridWidth >= 450 ? 3 : gridWidth >= 290 ? 2 : 1;
  const cardWidth = gridWidth > 0 ? (gridWidth - 8 * (columns - 1)) / columns : undefined;
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState<"money" | "coins" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const onSearch = useCallback((value: string) => { setQ(value); setPage(0); }, []);
  const query = useQuery({
    queryKey: ["admin", "users", q, page, adminToken],
    queryFn: () => adminApi.users(q, page, adminToken),
    placeholderData: keepPreviousData,
    staleTime: 15000,
  });
  const input = { color: theme.text, borderColor: theme.border, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 46 };

  async function resetBalances() {
    if (!reset || busy || reason.trim().length < 3 || confirmation !== `RESET ALL ${reset.toUpperCase()}`) return;
    setSaveError("");
    setBusy(true);
    try {
      await adminApi.resetBalances({ kind: reset, confirmation, reason: reason.trim(), operationId: crypto.randomUUID() }, adminToken);
      setReset(null);
      setNotice("Изменения сохранены. Аудит и прежние значения записаны.");
      await query.refetch();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить изменения.");
    } finally {
      setBusy(false);
    }
  }

  return <View style={{ gap: 14 }}>
    <AdminPageHeader title="Пользователи" description="Профили, настройки и текущие балансы. Деньги вводятся в центах: 1000 = $10. История заработка и резерв вывода сохраняются." />
    <AdminUserSearch onSearch={onSearch} />
    {notice ? <AppText accessibilityRole="alert">{copyContent(notice)}</AppText> : null}
    {query.error ? <AppText>{copyContent(String(query.error))}</AppText> : null}
    <AppText>{copyText("Всего: ")}{copyContent(query.data?.total ?? 0)}</AppText>
    <View onLayout={event => setGridWidth(event.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {(query.data?.users ?? []).map(user => {
        const balance = ((user.wallet?.availableUnits ?? 0) / 100).toFixed(2);
        const lifetime = ((user.wallet?.lifetimeEarnedUnits ?? 0) / 100).toFixed(2);
        return <Pressable key={user._id} accessibilityRole="button"
          accessibilityLabel={formatCopy("Редактировать {0}, баланс {1} долларов", [user.name, balance])}
          disabled={busy || query.isPlaceholderData} onPress={() => { setNotice(""); setSelected(user); }}
          style={({ pressed }) => ({ width: cardWidth ?? "100%", opacity: pressed ? 0.7 : 1 })}
        >
          <GlassSurface style={{ padding: 10, gap: 3, borderRadius: 14, minHeight: 132 }}>
            <AppText variant="label" numberOfLines={1}>{user.name}</AppText>
            <RoleBadge role={user.role} />
            <AppText variant="caption" muted numberOfLines={1}>{user.email}</AppText>
            <AppText variant="label" numberOfLines={1}>${copyContent(balance)} · {copyContent(user.coins?.balance ?? 0)} ◇</AppText>
            <AppText variant="caption" muted numberOfLines={1}>{copyText("Заработано $")}{copyContent(lifetime)}</AppText>
          </GlassSurface>
        </Pressable>;
      })}
    </View>
    <View style={{ flexDirection: "row", gap: 10 }}>
      <AppButton disabled={page === 0 || busy} onPress={() => setPage(value => value - 1)}>{copyText("Назад")}</AppButton>
      <AppButton disabled={(page + 1) * 25 >= (query.data?.total ?? 0) || busy} onPress={() => setPage(value => value + 1)}>{copyText("Далее")}</AppButton>
    </View>

    <AppText variant="heading">{copyText("Опасная зона")}</AppText>
    <AppText>{copyText("Массовое обнуление затронет все текущие доступные балансы выбранного типа. Резерв заявок на вывод и история начислений не удаляются.")}</AppText>
    {(["money", "coins"] as const).map(kind => <AppButton key={kind} disabled={busy} onPress={() => {
      setSaveError("");
      setReset(kind);
      setReason("");
      setConfirmation("");
    }}>{copyText("Обнулить ")}{copyContent(kind === "money" ? "деньги" : "coin")} {copyText(" у всех")}</AppButton>)}
    {selected ? <AdminUserEditor key={selected._id} user={selected} token={adminToken}
      onClose={() => setSelected(null)}
      onChanged={updated => {
        setNotice(updated ? "Изменения сохранены. Аудит и прежние значения записаны." : "Профиль удалён; финансовые записи обезличены.");
        void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      }} /> : null}
    <Modal visible={Boolean(reset)} transparent onRequestClose={() => { if (!busy) setReset(null); }}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", padding: 20, justifyContent: "center" }}>
        <ScrollView style={{ maxHeight: "90%" }} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: theme.surfaceRaised, padding: 20, borderRadius: 20, gap: 12 }}>
            <AppText variant="heading">{copyText("Массовое обнуление")}</AppText>
            <AppText>{copyText("Для подтверждения введите RESET ALL ")}{copyContent(reset?.toUpperCase())}{copyText(". Действие затронет всех пользователей.")}</AppText>
            <TextInput style={input} value={confirmation} onChangeText={setConfirmation} editable={!busy} />
            <TextInput style={input} placeholder={copyText("Причина изменения (обязательно)")} placeholderTextColor={String(theme.textMuted)}
              value={reason} onChangeText={setReason} maxLength={240} editable={!busy} />
            {saveError ? <AppText accessibilityRole="alert" color={String(theme.danger)}>{copyContent(saveError)}</AppText> : null}
            <AppButton disabled={busy || reason.trim().length < 3 || confirmation !== `RESET ALL ${reset?.toUpperCase()}`}
              onPress={() => void resetBalances()}>{copyText("Подтвердить и сохранить")}</AppButton>
            <AppButton disabled={busy} onPress={() => setReset(null)}>{copyText("Отмена")}</AppButton>
          </View>
        </ScrollView>
      </View>
    </Modal>
  </View>;
}

function AdminUserSearch({ onSearch }: { onSearch: (value: string) => void }) {
  const [value, setValue] = useState("");
  const theme = useAppTheme();
  const { copyText } = useUiCopy();
  useEffect(() => {
    const timer = setTimeout(() => onSearch(value.trim()), 250);
    return () => clearTimeout(timer);
  }, [value, onSearch]);
  return <TextInput accessibilityLabel="Поиск пользователей"
    style={{ color: theme.text, borderColor: theme.border, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 46 }}
    placeholder={copyText("Имя, никнейм, email или код приглашения")} placeholderTextColor={String(theme.textMuted)}
    value={value} onChangeText={setValue} />;
}
