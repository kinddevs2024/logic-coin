import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { ProgressBar } from "@/components/progress-bar";
import { ScreenHeader } from "@/components/screen-header";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { activityApi, bonusesApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import type { BonusKind } from "@/types";

const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const activeDays = new Set([
  1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22,
  23, 24,
]);

export default function BonusesScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const storedStreak = useAppStore((state) => state.streak);
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const addReward = useAppStore((state) => state.addReward);
  const setBalance = useAppStore((state) => state.setBalance);
  const queryClient = useQueryClient();
  const authenticated = authMode === "authenticated" && Boolean(accessToken);
  const [guestClaims, setGuestClaims] = useState<BonusKind[]>([]);
  const bonusQuery = useQuery({
    queryKey: ["bonuses", accessToken],
    queryFn: () => bonusesApi.overview(accessToken!),
    enabled: authenticated,
    staleTime: 15_000,
  });
  const activityQuery = useQuery({
    queryKey: ["activity", "bonuses", accessToken],
    queryFn: () => activityApi.list(accessToken!),
    enabled: authenticated,
    staleTime: 15_000,
  });
  const overview = bonusQuery.data;
  const activity = activityQuery.data;
  const streak = overview?.streak.activeDays ?? storedStreak;
  const daily = overview?.daily ?? {
    key: "demo-daily",
    rewardUnits: 15,
    claimed: guestClaims.includes("daily"),
    available: !guestClaims.includes("daily"),
  };
  const weekly = overview?.weekly ?? {
    key: "demo-weekly",
    rewardUnits: 25,
    activeDays: 5,
    requiredActiveDays: 6,
    claimed: guestClaims.includes("weekly"),
    available: false,
  };
  const monthly = overview?.monthly ?? {
    key: "demo-monthly",
    rewardUnits: 100,
    activeDays: 24,
    requiredActiveDays: 24,
    claimed: guestClaims.includes("monthly"),
    available: !guestClaims.includes("monthly"),
  };
  const activeDayNumbers = new Set(
    activity?.days
      .filter((day) => day.dayKey.startsWith((overview?.today ?? "").slice(0, 7)))
      .map((day) => Number(day.dayKey.slice(-2))) ?? [...activeDays],
  );
  const todayKey = overview?.today;
  const calendarYear = Number(todayKey?.slice(0, 4) ?? 2026);
  const calendarMonth = Number(todayKey?.slice(5, 7) ?? 7);
  const currentDay = Number(todayKey?.slice(8, 10) ?? 24);
  const calendarDays = new Date(
    Date.UTC(calendarYear, calendarMonth, 0),
  ).getUTCDate();
  const calendarLeading =
    (new Date(Date.UTC(calendarYear, calendarMonth - 1, 1)).getUTCDay() + 6) %
    7;
  const claimMutation = useMutation({
    mutationFn: (kind: BonusKind) => bonusesApi.claim(kind, accessToken!),
    onSuccess: (result, kind) => {
      addReward(`bonus-${kind}`, result.claim.rewardUnits);
      setBalance(result.wallet.availableUnits);
      void queryClient.invalidateQueries({ queryKey: ["bonuses"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (error) => {
      Alert.alert(
        t("bonus.title"),
        error instanceof Error ? error.message : "Bonus is not available",
      );
    },
  });
  const claim = (kind: BonusKind, rewardUnits: number) => {
    if (authenticated) {
      claimMutation.mutate(kind);
      return;
    }
    if (guestClaims.includes(kind)) return;
    setGuestClaims((items) => [...items, kind]);
    addReward(`demo-bonus-${kind}`, rewardUnits);
  };

  return (
    <AppFrame>
      <ScreenHeader title={t("bonus.title")} subtitle={t("bonus.subtitle")} />

      <LinearGradient
        colors={["#0866FF", "#1766DC", "#634AE8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { shadowColor: theme.primary }]}
      >
        <View style={styles.heroIcon}>
          <Ionicons name="flame" size={27} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color="rgba(255,255,255,0.72)">
            {t("bonus.streak")}
          </AppText>
          <View style={styles.streakRow}>
            <AppText variant="display" color="#FFFFFF">
              {streak}
            </AppText>
            <AppText variant="heading" color="rgba(255,255,255,0.82)">
              {t("bonus.days")}
            </AppText>
          </View>
        </View>
        <View style={styles.nextBadge}>
          <AppText variant="caption" color="rgba(255,255,255,0.72)">
            {t("bonus.next")}
          </AppText>
          <AppText variant="label" color="#FFFFFF">
            +{daily.rewardUnits} LC
          </AppText>
          <AppText variant="caption" color="rgba(255,255,255,0.72)">
            {t("bonus.nextIn")}
          </AppText>
        </View>
      </LinearGradient>

      <View style={styles.dailyAction}>
        <AppButton
          icon="gift-outline"
          glow
          loading={
            claimMutation.isPending && claimMutation.variables === "daily"
          }
          disabled={!daily.available || daily.claimed}
          onPress={() => claim("daily", daily.rewardUnits)}
        >
          {daily.claimed
            ? t("task.received")
            : `${t("task.perform")} · +${daily.rewardUnits} LC`}
        </AppButton>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surfaceRaised,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View>
            <AppText variant="heading">{t("bonus.calendar")}</AppText>
            <AppText variant="caption" muted>
              {t("profile.active")}
            </AppText>
          </View>
          <View
            style={[styles.monthChip, { backgroundColor: theme.primarySoft }]}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={String(theme.primary)}
            />
            <AppText variant="caption" color={String(theme.primary)}>
              {activeDayNumbers.size} / {calendarDays}
            </AppText>
          </View>
        </View>
        <View style={styles.weekLabels}>
          {days.map((day) => (
            <AppText
              key={day}
              variant="caption"
              muted
              style={styles.calendarCell}
            >
              {day}
            </AppText>
          ))}
        </View>
        <View style={styles.calendar}>
          {Array.from({ length: calendarLeading }).map((_, index) => (
            <View key={`blank-${index}`} style={styles.calendarCell} />
          ))}
          {Array.from({ length: calendarDays }, (_, index) => {
            const day = index + 1;
            const active = activeDayNumbers.has(day);
            const today = day === currentDay;
            return (
              <View key={day} style={styles.calendarCell}>
                <View
                  style={[
                    styles.day,
                    {
                      backgroundColor: today
                        ? theme.primary
                        : active
                          ? theme.primarySoft
                          : theme.surfaceMuted,
                      borderColor: today ? theme.primary : theme.border,
                    },
                  ]}
                >
                  {active && !today ? (
                    <View
                      style={[styles.activeDot, { backgroundColor: theme.primary }]}
                    />
                  ) : null}
                  <AppText
                    variant="caption"
                    color={today ? "#FFFFFF" : undefined}
                  >
                    {day}
                  </AppText>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.progressCards}>
        <View
          style={[
            styles.progressCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.progressTitle}>
            <View>
              <AppText variant="label">{t("bonus.week")}</AppText>
              <AppText variant="caption" muted>
                {weekly.activeDays ?? 0} / {weekly.requiredActiveDays ?? 0}{" "}
                {t("bonus.days")}
              </AppText>
            </View>
            <AppText variant="label" color={String(theme.primary)}>
              +{weekly.rewardUnits} LC
            </AppText>
          </View>
          <ProgressBar
            value={
              (weekly.activeDays ?? 0) /
              Math.max(1, weekly.requiredActiveDays ?? 1)
            }
          />
          <AppButton
            compact
            variant="secondary"
            loading={
              claimMutation.isPending && claimMutation.variables === "weekly"
            }
            disabled={!weekly.available || weekly.claimed}
            onPress={() => claim("weekly", weekly.rewardUnits)}
          >
            {weekly.claimed ? t("task.received") : t("task.perform")}
          </AppButton>
        </View>
        <View
          style={[
            styles.progressCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.progressTitle}>
            <View>
              <AppText variant="label">{t("bonus.month")}</AppText>
              <AppText variant="caption" muted>
                {monthly.activeDays ?? 0} /{" "}
                {monthly.requiredActiveDays ?? 0} {t("bonus.days")}
              </AppText>
            </View>
            <AppText variant="label" color="#7A5AF8">
              +{monthly.rewardUnits} LC
            </AppText>
          </View>
          <ProgressBar
            value={
              (monthly.activeDays ?? 0) /
              Math.max(1, monthly.requiredActiveDays ?? 1)
            }
            color="#7A5AF8"
          />
          <AppButton
            compact
            variant="secondary"
            loading={
              claimMutation.isPending && claimMutation.variables === "monthly"
            }
            disabled={!monthly.available || monthly.claimed}
            onPress={() => claim("monthly", monthly.rewardUnits)}
          >
            {monthly.claimed ? t("task.received") : t("task.perform")}
          </AppButton>
        </View>
      </View>

      <View
        style={[
          styles.grace,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View
          style={[
            styles.shield,
            { backgroundColor: `${String(theme.success)}18` },
          ]}
        >
          <Ionicons
            name="shield-checkmark"
            size={24}
            color={String(theme.success)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="label">{t("bonus.grace")}</AppText>
          <AppText variant="caption" muted>
            {t("bonus.graceBody")}
          </AppText>
        </View>
        <View style={[styles.available, { backgroundColor: theme.primarySoft }]}>
          <AppText variant="caption" color={String(theme.primary)}>
            1×
          </AppText>
        </View>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radii.xl,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 9,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  nextBadge: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    padding: 11,
    alignItems: "flex-end",
  },
  dailyAction: {
    marginTop: 12,
  },
  card: {
    marginTop: 18,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 18,
    shadowOpacity: Platform.OS === "web" ? 0.06 : 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  monthChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    gap: 6,
  },
  weekLabels: {
    flexDirection: "row",
    marginBottom: 8,
  },
  calendar: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 7,
  },
  calendarCell: {
    width: `${100 / 7}%`,
    textAlign: "center",
    alignItems: "center",
  },
  day: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activeDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  progressCards: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  progressCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 14,
    gap: 12,
  },
  progressTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  grace: {
    marginTop: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  shield: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  available: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
});
