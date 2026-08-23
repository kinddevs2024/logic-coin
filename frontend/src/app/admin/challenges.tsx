import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type SetStateAction } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { AdminDataState, AdminPageHeader, formatUnits } from "@/components/admin/admin-ui";
import { useAdminSession } from "@/components/admin/admin-session";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { adminApi, type AdminChallengeSelectionMode } from "@/lib/api";
import { localDayKey } from "@/lib/date";

type Draft = {
  selectionMode: AdminChallengeSelectionMode;
  selected: string[];
  minimum: string;
  maximum: string;
  pool: string;
  maxAttempts: string;
  oneSecondAttempts: string;
};

function emptyDraft(): Draft {
  return { selectionMode: "manual", selected: [], minimum: "", maximum: "", pool: "", maxAttempts: "1", oneSecondAttempts: "20" };
}

function offsetDayKey(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return localDayKey(date);
}

function statusLabel(status: string) {
  if (status === "published") return "Опубликован";
  if (status === "settled") return "Завершён";
  return "Черновик";
}

export default function AdminChallengesScreen() {
  const theme = useAppTheme();
  const { isDesktop } = useResponsiveLayout();
  const { adminToken } = useAdminSession();
  const queryClient = useQueryClient();
  const [dayKey, setDayKey] = useState(localDayKey());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [notice, setNotice] = useState("");
  const [confirmSettlement, setConfirmSettlement] = useState(false);

  const range = useMemo(() => ({ from: offsetDayKey(-30), to: offsetDayKey(7) }), []);
  const historyQuery = useQuery({
    queryKey: ["admin", "challenges", range.from, range.to],
    queryFn: () => adminApi.challenges(range, adminToken),
  });
  const gamesQuery = useQuery({
    queryKey: ["admin", "games"],
    queryFn: () => adminApi.games(adminToken),
  });
  const challengeQuery = useQuery({
    queryKey: ["admin", "challenge", dayKey],
    queryFn: () => adminApi.challenge(dayKey, adminToken),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(dayKey),
  });
  const challenge = challengeQuery.data?.challenge ?? null;
  const serverDraft = challenge ? {
    selectionMode: challenge.selectionMode,
    selected: challenge.games.map((game) => game.key),
    minimum: String(challenge.cashPrizeMinUnits),
    maximum: String(challenge.cashPrizeMaxUnits),
    pool: String(challenge.prizePoolUnits),
    maxAttempts: String(challenge.maxAttemptsPerGame ?? 1),
    oneSecondAttempts: String(challenge.oneSecondAttemptLimit ?? 20),
  } satisfies Draft : emptyDraft();
  const draft = drafts[dayKey] ?? serverDraft;
  const setDraft = (next: SetStateAction<Draft>) => {
    setDrafts((current) => {
      const currentDraft = current[dayKey] ?? serverDraft;
      return {
        ...current,
        [dayKey]: typeof next === "function" ? next(currentDraft) : next,
      };
    });
  };
  const selectDay = (nextDayKey: string) => {
    setDayKey(nextDayKey);
    setNotice("");
  };

  const save = useMutation({
    mutationFn: (publish: boolean) => adminApi.saveChallenge({
      dayKey,
      selectionMode: draft.selectionMode,
      ...(draft.selectionMode === "manual" ? { gameKeys: draft.selected } : {}),
      cashPrizeMinUnits: Number(draft.minimum),
      cashPrizeMaxUnits: Number(draft.maximum),
      prizePoolUnits: Number(draft.pool),
      maxAttemptsPerGame: Number(draft.maxAttempts),
      oneSecondAttemptLimit: Number(draft.oneSecondAttempts),
      publish,
    }, adminToken),
    onSuccess: (result, publish) => {
      setNotice(
        publish
          ? result.notificationEvent
            ? `Челлендж опубликован. Уведомление создано для ${result.notificationEvent.targetCount} пользователей.`
            : "Челлендж опубликован. Активных устройств для уведомления пока нет."
          : "Черновик сохранён.",
      );
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Не удалось сохранить челлендж"),
  });
  const settle = useMutation({
    mutationFn: () => adminApi.settle(dayKey, adminToken),
    onSuccess: () => {
      setConfirmSettlement(false);
      setNotice("Результаты рассчитаны и награды начислены.");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Не удалось рассчитать результаты"),
  });

  const numericValues = [draft.minimum, draft.maximum, draft.pool].map(Number);
  const validAttempts = /^\d+$/.test(draft.maxAttempts) && Number(draft.maxAttempts) >= 1 && Number(draft.maxAttempts) <= 100;
  const validOneSecondAttempts = /^\d+$/.test(draft.oneSecondAttempts) && Number(draft.oneSecondAttempts) >= 1 && Number(draft.oneSecondAttempts) <= 100;
  const validMoney = draft.minimum !== "" && draft.maximum !== "" && draft.pool !== "" && numericValues.every((value) => Number.isFinite(value) && value >= 0) && numericValues[1] >= numericValues[0] && numericValues[2] >= numericValues[1];
  const validGames = draft.selectionMode === "random" || draft.selected.length === 6;
  const canSave = /^\d{4}-\d{2}-\d{2}$/.test(dayKey) && validMoney && validGames && validAttempts && validOneSecondAttempts && !save.isPending;

  const updateNumber = (key: "minimum" | "maximum" | "pool", value: string) => {
    setDraft((current) => ({ ...current, [key]: value.replace(/[^0-9]/g, "") }));
    setNotice("");
  };
  const toggleGame = (key: string) => {
    setDraft((current) => {
      const selected = current.selected.includes(key)
        ? current.selected.filter((item) => item !== key)
        : current.selected.length < 6
          ? [...current.selected, key]
          : current.selected;
      return { ...current, selected };
    });
    setNotice("");
  };

  return (
    <View style={styles.page}>
      <AdminPageHeader title="Челленджи" description="История, настройка и публикация ежедневных игр" />
      <View style={[styles.columns, isDesktop && styles.columnsDesktop]}>
        <GlassSurface intensity={68} variant="strong" style={[styles.panel, styles.historyPanel]}>
          <View style={styles.panelHeader}>
            <View><AppText variant="heading">История</AppText><AppText variant="caption" muted>{range.from} — {range.to}</AppText></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Обновить историю" onPress={() => void historyQuery.refetch()} style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.primarySoft }, pressed && styles.pressed]}><Ionicons name="refresh" size={18} color={String(theme.primary)} /></Pressable>
          </View>
          <AdminDataState loading={historyQuery.isPending} error={historyQuery.error} empty={historyQuery.data?.challenges.length === 0} emptyText="Опубликованных и сохранённых дней пока нет" onRetry={() => void historyQuery.refetch()} />
          <View style={styles.historyList}>
            {(historyQuery.data?.challenges ?? []).map((entry) => {
              const active = entry.dayKey === dayKey;
              const statusColor = entry.status === "published" ? theme.success : entry.status === "settled" ? theme.primary : theme.warning;
              return (
                <Pressable key={entry.dayKey} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => selectDay(entry.dayKey)} style={({ pressed }) => [styles.historyRow, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primarySoft : theme.surfaceRaised }, pressed && styles.pressed]}>
                  <View style={[styles.calendarIcon, { backgroundColor: `${String(statusColor)}14` }]}><Ionicons name="calendar-outline" size={19} color={String(statusColor)} /></View>
                  <View style={styles.historyCopy}><AppText variant="label">{entry.dayKey}</AppText><AppText variant="caption" muted>{entry.games.length} игр · {entry.selectionMode === "random" ? "случайно" : "вручную"}</AppText></View>
                  <View style={[styles.statusPill, { backgroundColor: `${String(statusColor)}14` }]}><AppText style={[styles.statusText, { color: statusColor }]}>{statusLabel(entry.status)}</AppText></View>
                </Pressable>
              );
            })}
          </View>
          <Pressable accessibilityRole="button" onPress={() => selectDay(localDayKey())} style={[styles.todayButton, { borderColor: theme.border }]}><Ionicons name="today-outline" size={17} color={String(theme.primary)} /><AppText variant="caption" color={String(theme.primary)}>Открыть сегодня</AppText></Pressable>
        </GlassSurface>

        <GlassSurface intensity={72} variant="strong" style={[styles.panel, styles.editorPanel]}>
          <View style={styles.panelHeader}>
            <View><AppText variant="heading">Редактор дня</AppText><AppText variant="caption" muted>{challenge ? statusLabel(challenge.status) : "Новый челлендж"}</AppText></View>
            {challenge ? <View style={[styles.statusPill, { backgroundColor: theme.primarySoft }]}><AppText style={[styles.statusText, { color: theme.primary }]}>{challenge.selectionMode === "random" ? "RANDOM" : "MANUAL"}</AppText></View> : null}
          </View>
          <AdminDataState loading={challengeQuery.isPending} error={challengeQuery.error} onRetry={() => void challengeQuery.refetch()} />
          {!challengeQuery.isPending && !challengeQuery.error ? (
            <>
              <View style={styles.field}>
                <AppText variant="caption" muted>Дата</AppText>
                <View style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}><Ionicons name="calendar-outline" size={18} color={String(theme.textMuted)} /><TextInput value={dayKey} onChangeText={selectDay} placeholder="YYYY-MM-DD" placeholderTextColor={String(theme.textMuted)} style={[styles.input, { color: theme.text }]} /></View>
              </View>

              <View style={styles.field}>
                <AppText variant="caption" muted>Выбор игр</AppText>
                <View style={[styles.segment, { borderColor: theme.border }]}>
                  {(["manual", "random"] as const).map((mode) => {
                    const active = draft.selectionMode === mode;
                    return <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setDraft((current) => ({ ...current, selectionMode: mode }))} style={[styles.segmentItem, active && { backgroundColor: theme.primary }]}><Ionicons name={mode === "manual" ? "options-outline" : "shuffle-outline"} size={17} color={active ? "#FFFFFF" : String(theme.textMuted)} /><AppText variant="caption" color={active ? "#FFFFFF" : String(theme.textMuted)}>{mode === "manual" ? "Вручную" : "Случайно"}</AppText></Pressable>;
                  })}
                </View>
              </View>

              {draft.selectionMode === "manual" ? (
                <View style={styles.field}>
                  <View style={styles.fieldHeader}><AppText variant="caption" muted>Ровно 6 игр</AppText><AppText variant="caption" color={String(draft.selected.length === 6 ? theme.success : theme.primary)}>{draft.selected.length}/6</AppText></View>
                  <AdminDataState loading={gamesQuery.isPending} error={gamesQuery.error} empty={gamesQuery.data?.length === 0} emptyText="Игры не добавлены в каталог" onRetry={() => void gamesQuery.refetch()} />
                  <View style={styles.games}>
                    {(gamesQuery.data ?? []).filter((game) => game.enabled !== false && game.challengeEnabled).map((game) => {
                      const active = draft.selected.includes(game.key);
                      return <Pressable key={game.key} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => toggleGame(game.key)} style={({ pressed }) => [styles.game, { borderColor: active ? game.color : theme.border, backgroundColor: active ? `${game.color}12` : theme.surfaceRaised }, pressed && styles.pressed]}><Ionicons name={game.icon as React.ComponentProps<typeof Ionicons>["name"]} size={19} color={game.color} /><AppText style={styles.gameTitle} numberOfLines={1}>{game.title}</AppText>{active ? <Ionicons name="checkmark-circle" size={18} color={game.color} /> : null}</Pressable>;
                    })}
                  </View>
                </View>
              ) : (
                <View style={[styles.randomNote, { backgroundColor: theme.primarySoft }]}><Ionicons name="shuffle" size={21} color={String(theme.primary)} /><View style={styles.randomCopy}><AppText variant="label" color={String(theme.primary)}>Шесть игр выберет сервер</AppText><AppText variant="caption" color={String(theme.textMuted)}>Только активные игры, доступные для челленджа</AppText></View></View>
              )}

              <View style={styles.moneyFields}>
                {([[
                  "Минимальный приз", "minimum", draft.minimum,
                ], ["Максимальный приз", "maximum", draft.maximum], ["Призовой фонд", "pool", draft.pool]] as const).map(([label, key, value]) => (
                  <View key={key} style={styles.moneyField}><AppText variant="caption" muted>{label}</AppText><View style={[styles.numberWrap, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}><TextInput keyboardType="number-pad" value={value} onChangeText={(next) => updateNumber(key, next)} placeholder="0" placeholderTextColor={String(theme.textMuted)} style={[styles.numberInput, { color: theme.text }]} /><AppText variant="caption" muted>LC</AppText></View></View>
                ))}
              </View>
              <View style={styles.moneyFields}>
                <View style={styles.moneyField}><AppText variant="caption" muted>Повторных прохождений игры</AppText><View style={[styles.numberWrap, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}><TextInput keyboardType="number-pad" value={draft.maxAttempts} onChangeText={(value) => setDraft((current) => ({ ...current, maxAttempts: value.replace(/[^0-9]/g, "") }))} placeholder="1" placeholderTextColor={String(theme.textMuted)} style={[styles.numberInput, { color: theme.text }]} /><AppText variant="caption" muted>раз</AppText></View></View>
                <View style={styles.moneyField}><AppText variant="caption" muted>Попыток внутри «1 Секунды»</AppText><View style={[styles.numberWrap, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}><TextInput keyboardType="number-pad" value={draft.oneSecondAttempts} onChangeText={(value) => setDraft((current) => ({ ...current, oneSecondAttempts: value.replace(/[^0-9]/g, "") }))} placeholder="20" placeholderTextColor={String(theme.textMuted)} style={[styles.numberInput, { color: theme.text }]} /><AppText variant="caption" muted>раз</AppText></View></View>
              </View>
              {!validMoney && (draft.minimum || draft.maximum || draft.pool) ? <AppText variant="caption" color={String(theme.danger)}>Фонд должен покрывать максимальный приз, а максимум — минимальный.</AppText> : null}
              {notice ? <View style={[styles.notice, { backgroundColor: notice.includes("не удалось") || notice.includes("cannot") ? `${String(theme.danger)}12` : `${String(theme.success)}12` }]}><Ionicons name="information-circle-outline" size={18} color={String(theme.textMuted)} /><AppText variant="caption" style={styles.noticeCopy}>{notice}</AppText></View> : null}

              <View style={styles.actions}>
                <AppButton variant="secondary" icon="save-outline" disabled={!canSave} loading={save.isPending && save.variables === false} onPress={() => save.mutate(false)} style={[styles.action, !isDesktop && styles.actionMobile]}>Сохранить</AppButton>
                <AppButton icon="paper-plane-outline" disabled={!canSave} loading={save.isPending && save.variables === true} onPress={() => save.mutate(true)} style={[styles.action, !isDesktop && styles.actionMobile]}>Опубликовать</AppButton>
              </View>
              {challenge?.status === "published" ? <AppButton variant="ghost" icon="trophy-outline" loading={settle.isPending} onPress={() => setConfirmSettlement(true)} style={!isDesktop ? styles.actionMobile : undefined}>Рассчитать итоги сейчас</AppButton> : null}
              {confirmSettlement ? (
                <View style={[styles.settlementConfirm, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
                  <View style={styles.settlementCopy}><AppText variant="label">Завершить челлендж?</AppText><AppText variant="caption" muted>Рейтинг будет зафиксирован, а деньги, подарки и coin сразу начислятся участникам.</AppText></View>
                  <View style={[styles.settlementActions, !isDesktop && styles.settlementActionsMobile]}>
                    <AppButton variant="secondary" compact onPress={() => setConfirmSettlement(false)} style={!isDesktop ? styles.actionMobile : undefined}>Отмена</AppButton>
                    <AppButton compact icon="checkmark-circle-outline" loading={settle.isPending} onPress={() => settle.mutate()} style={!isDesktop ? styles.actionMobile : undefined}>Рассчитать</AppButton>
                  </View>
                </View>
              ) : null}
              {challenge ? <AppText variant="caption" muted>Фонд: {formatUnits(challenge.prizePoolUnits)} LC{challenge.endsAt ? ` · автостоп ${new Date(challenge.endsAt).toLocaleString("ru-RU")}` : ""}{challenge.updatedAt ? ` · обновлён ${new Date(challenge.updatedAt).toLocaleString("ru-RU")}` : ""}</AppText> : null}
            </>
          ) : null}
        </GlassSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 16 },
  columns: { gap: 12 },
  columnsDesktop: { flexDirection: "row", alignItems: "flex-start" },
  panel: { borderRadius: 28, padding: 16, gap: 14 },
  historyPanel: { flex: 0.78, minWidth: 0 },
  editorPanel: { flex: 1.35, minWidth: 0 },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  historyList: { gap: 7 },
  historyRow: { minHeight: 64, borderRadius: 19, borderWidth: 1, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 9 },
  calendarIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  historyCopy: { flex: 1, minWidth: 0 },
  statusPill: { minHeight: 28, borderRadius: 14, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  statusText: { fontSize: 9, lineHeight: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.35 },
  todayButton: { minHeight: 42, borderRadius: 21, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  field: { gap: 7 },
  fieldHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  inputWrap: { minHeight: 50, borderRadius: 17, borderWidth: 1, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "800", outlineStyle: "none" } as never,
  segment: { minHeight: 48, borderRadius: 17, borderWidth: 1, padding: 3, flexDirection: "row" },
  segmentItem: { flex: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  games: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  game: { width: "31%", flexGrow: 1, minWidth: 150, minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 7 },
  gameTitle: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 14, fontWeight: "800" },
  randomNote: { minHeight: 68, borderRadius: 19, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11 },
  randomCopy: { flex: 1, minWidth: 0 },
  moneyFields: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  moneyField: { flex: 1, minWidth: 130, gap: 6 },
  numberWrap: { minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6 },
  numberInput: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "900", outlineStyle: "none" } as never,
  notice: { minHeight: 42, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeCopy: { flex: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { flex: 1, minWidth: 160 },
  actionMobile: { flex: 0, minWidth: 0, width: "100%" },
  settlementConfirm: { borderRadius: 19, borderWidth: 1, padding: 13, gap: 12 },
  settlementCopy: { gap: 3 },
  settlementActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  settlementActionsMobile: { flexDirection: "column" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
