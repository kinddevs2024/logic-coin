import { Ionicons } from "@expo/vector-icons";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, View } from "react-native";

import { AdminBarChart, AdminDataState, AdminMetricCard, AdminPageHeader, formatUnits } from "@/components/admin/admin-ui";
import { useAdminSession } from "@/components/admin/admin-session";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { adminApi } from "@/lib/api";
import { localDayKey } from "@/lib/date";

function offsetDayKey(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return localDayKey(date);
}

function shortDay(dayKey: string) {
  return dayKey.slice(8, 10);
}

export default function AdminOverviewScreen() {
  const theme = useAppTheme();
  const { adminToken } = useAdminSession();
  const dayKey = localDayKey();
  const overviewQuery = useQuery({
    queryKey: ["admin", "overview", dayKey],
    queryFn: () => adminApi.overview(dayKey, adminToken),
  });
  const challengeQuery = useQuery({
    queryKey: ["admin", "challenge", dayKey],
    queryFn: () => adminApi.challenge(dayKey, adminToken),
  });
  const trendDays = Array.from({ length: 7 }, (_, index) => offsetDayKey(index - 6));
  const trendQueries = useQueries({
    queries: trendDays.map((trendDay) => ({
      queryKey: ["admin", "overview", trendDay],
      queryFn: () => adminApi.overview(trendDay, adminToken),
      staleTime: 60_000,
    })),
  });

  if (overviewQuery.isPending) return <AdminDataState loading />;
  if (overviewQuery.error) return <AdminDataState error={overviewQuery.error} onRetry={() => void overviewQuery.refetch()} />;

  const overview = overviewQuery.data;
  const trend = trendQueries.flatMap((query) => query.data ? [query.data] : []);
  const games = challengeQuery.data?.challenge?.games ?? [];

  return (
    <View style={styles.page}>
      <AdminPageHeader
        title="Сегодня"
        description={`Данные из базы · ${dayKey} · ${overview.timezone}`}
        action={
          <Pressable accessibilityRole="button" accessibilityLabel="Обновить аналитику" onPress={() => { void overviewQuery.refetch(); void challengeQuery.refetch(); }} style={({ pressed }) => [styles.refresh, { borderColor: theme.border }, pressed && styles.pressed]}>
            <Ionicons name="refresh" size={18} color={String(theme.primary)} />
          </Pressable>
        }
      />

      <View style={styles.metrics}>
        <AdminMetricCard label="Новые регистрации" value={formatUnits(overview.registrations)} icon="person-add-outline" detail={overview.registrationGrowthPercent === null ? "Нет прошлого периода" : `${overview.registrationGrowthPercent >= 0 ? "+" : ""}${formatUnits(overview.registrationGrowthPercent)}% к прошлому дню`} tone={overview.registrationGrowthPercent !== null && overview.registrationGrowthPercent < 0 ? "danger" : "primary"} />
        <AdminMetricCard label="Всего пользователей" value={formatUnits(overview.totalUsers)} icon="people-outline" />
        <AdminMetricCard label="Активные игроки" value={formatUnits(overview.activePlayers)} icon="pulse-outline" tone="success" />
        <AdminMetricCard label="Участники челленджа" value={formatUnits(overview.challengeParticipants)} icon="game-controller-outline" />
        <AdminMetricCard label="Завершённые игры" value={formatUnits(overview.completedAttempts)} icon="checkmark-done-outline" tone="success" />
        <AdminMetricCard label="Выдано coin" value={formatUnits(overview.coinsIssued)} icon="diamond-outline" tone="warning" />
        <AdminMetricCard label="Выдано LC" value={formatUnits(overview.moneyIssuedUnits)} icon="cash-outline" tone="success" />
      </View>

      <View style={styles.grid}>
        <GlassSurface intensity={70} variant="strong" style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <AppText variant="heading">Активность за 7 дней</AppText>
              <AppText variant="caption" muted>Уникальные активные игроки</AppText>
            </View>
            <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
          </View>
          {trend.length ? (
            <AdminBarChart values={trend.map((point) => point.activePlayers)} labels={trend.map((point) => shortDay(point.dayKey))} color={String(theme.primary)} />
          ) : (
            <AdminDataState loading={trendQueries.some((query) => query.isPending)} error={trendQueries.find((query) => query.error)?.error} empty />
          )}
        </GlassSurface>

        <GlassSurface intensity={70} variant="strong" style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <AppText variant="heading">Coin за 7 дней</AppText>
              <AppText variant="caption" muted>Фактические начисления</AppText>
            </View>
            <View style={[styles.legendDot, { backgroundColor: theme.warning }]} />
          </View>
          {trend.length ? (
            <AdminBarChart values={trend.map((point) => point.coinsIssued)} labels={trend.map((point) => shortDay(point.dayKey))} color={String(theme.warning)} />
          ) : (
            <AdminDataState loading={trendQueries.some((query) => query.isPending)} error={trendQueries.find((query) => query.error)?.error} empty />
          )}
        </GlassSurface>
      </View>

      <GlassSurface intensity={72} variant="strong" style={styles.gamesPanel}>
        <View style={styles.panelHeader}>
          <View>
            <AppText variant="heading">Игры сегодня</AppText>
            <AppText variant="caption" muted>{challengeQuery.data?.challenge ? `${games.length} из 6 · ${challengeQuery.data.challenge.status}` : "Челлендж не опубликован"}</AppText>
          </View>
          {challengeQuery.data?.challenge ? <View style={[styles.status, { backgroundColor: theme.primarySoft }]}><View style={[styles.liveDot, { backgroundColor: challengeQuery.data.challenge.status === "published" ? theme.success : theme.warning }]} /><AppText variant="caption" color={String(theme.primary)}>{challengeQuery.data.challenge.selectionMode === "random" ? "Случайный" : "Ручной"}</AppText></View> : null}
        </View>
        <AdminDataState loading={challengeQuery.isPending} error={challengeQuery.error} empty={!challengeQuery.isPending && !challengeQuery.error && games.length === 0} emptyText="На сегодня челлендж не создан" onRetry={() => void challengeQuery.refetch()} />
        {games.length ? (
          <View style={styles.games}>
            {games.map((game, index) => (
              <View key={game.key} style={[styles.game, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
                <View style={[styles.gameOrder, { backgroundColor: `${game.color}18` }]}><AppText style={{ color: game.color, fontWeight: "900" }}>{index + 1}</AppText></View>
                <Ionicons name={game.icon as React.ComponentProps<typeof Ionicons>["name"]} size={20} color={game.color} />
                <AppText variant="label" numberOfLines={1} style={styles.gameTitle}>{game.title}</AppText>
              </View>
            ))}
          </View>
        ) : null}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 16 },
  refresh: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.26)" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  panel: { flex: 1, minWidth: 290, borderRadius: 26, padding: 16 },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  gamesPanel: { borderRadius: 28, padding: 17, gap: 14 },
  status: { minHeight: 34, borderRadius: 17, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  games: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  game: { width: "31%", flexGrow: 1, minWidth: 190, minHeight: 58, borderRadius: 18, borderWidth: 1, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 9 },
  gameOrder: { width: 30, height: 30, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  gameTitle: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
});
