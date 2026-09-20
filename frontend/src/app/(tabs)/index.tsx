import { useRouter } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RankingPreview } from "@/components/ranking-preview";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Circle } from "react-native-svg";
import { Pressable, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppButton, IconButton } from "@/components/buttons";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { ChallengeCard } from "@/components/challenge-card";
import { ChallengeEmptyState } from "@/components/challenge-empty-state";
import { GlassSurface } from "@/components/glass-surface";
import { LeaderboardModal } from "@/components/leaderboard-modal";
import { NotificationInbox } from "@/components/notification-inbox";
import { ProfileDrawer } from "@/components/profile-drawer";
import { SavingsScene } from "@/components/savings-scene";
import { SectionHeader } from "@/components/section-header";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useChallenges } from "@/hooks/use-challenges";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";

function ProgressDonut({ value, progress, color, accessibilityLabel }: { value: string; progress: number; color: string; accessibilityLabel: string }) {
  const size = 64;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = Math.max(0, Math.min(1, progress)) * circumference;
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.donut}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(116,154,200,0.18)" strokeWidth={strokeWidth} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`} rotation="-90" origin={`${size / 2}, ${size / 2}`} />
      </Svg>
      <AppText style={[styles.donutValue, { color }]}>{value}</AppText>
    </View>
  );
}

export default function HomeScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isDesktop } = useResponsiveLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const refreshHome = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all(["bootstrap", "challenges", "leaderboard"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    } finally { setRefreshing(false); }
  };
  const balance = useAppStore((state) => state.balanceUnits);
  const goal = useAppStore((state) => state.goalUnits);
  const user = useAppStore((state) => state.user);
  const { today, pendingGameKey } = useChallenges();

  return (
    <AppFrame wide desktopNavigationInset contentStyle={styles.content} onOpenProfile={() => setDrawerOpen(true)} onSwipeRefresh={() => void refreshHome()} swipesDisabled={drawerOpen || leaderboardOpen || inboxOpen}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("tabs.profile")} onPress={() => setDrawerOpen(true)}><Avatar name={user.name} avatarUrl={user.avatarUrl} size={44} /></Pressable>
        </View>
        <RankingPreview metric="wealth" onPress={() => setLeaderboardOpen(true)} />
        <View style={[styles.headerSide, styles.headerSideEnd]}>
          <IconButton
            name="notifications-outline"
            label="Уведомления"
            onPress={() => setInboxOpen(true)}
          />
        </View>
      </View>

      {refreshing ? <AppText accessibilityLiveRegion="polite" muted>Обновляем…</AppText> : null}

      <View style={[styles.dashboard, isDesktop && styles.dashboardDesktop]}>
        <View style={[styles.hero, isDesktop && styles.heroDesktop]}>
          <SavingsScene balance={balance} goal={goal} />

          <View style={styles.actions}>
            <AppButton
              variant="secondary"
              icon="flash"
              onPress={() => router.push("/challenges" as never)}
              style={styles.action}
            >
              {t("home.earn")}
            </AppButton>
            <AppButton
              icon="wallet"
              onPress={() => router.push("/withdraw")}
              glow
              style={styles.action}
            >
              {t("home.withdraw")}
            </AppButton>
          </View>
        </View>

        <GlassSurface
          intensity={68}
          variant="strong"
          style={[
            styles.tasksPanel,
            isDesktop && styles.tasksPanelDesktop,
            { borderColor: theme.glassBorder },
          ]}
        >
          <SectionHeader
            title={t("home.today")}
            action={`${today?.completedCount ?? 0}/${today?.totalCount ?? 0} · ${t("home.allChallenges")}`}
            onAction={() => router.push("/challenges" as never)}
          />
          <View style={styles.taskList}>
            {(today?.games ?? []).map((game, index) => (
              <ChallengeCard
                key={game.key}
                game={game}
                state={game.state}
                compact
                index={index}
                loading={pendingGameKey === game.key}
                onPress={() => router.push({ pathname: "/play/[gameKey]", params: { gameKey: game.key, mode: "challenge" } } as never)}
              />
            ))}
            {!today?.games.length ? <ChallengeEmptyState compact /> : null}
          </View>
          <GlassSurface
            intensity={58}
            variant="soft"
            style={[styles.activityStrip, { borderColor: theme.glassBorder }]}
          >
            <View style={styles.activityItem}>
              <View style={styles.activityInfo}>
                <View style={[styles.activityIcon, { backgroundColor: theme.primarySoft }]}>
                  <Ionicons name="game-controller-outline" size={21} color={String(theme.primary)} />
                </View>
                <View style={styles.activityCopy}>
                  <AppText style={styles.activityTitle}>Игр сегодня</AppText>
                </View>
              </View>
              <ProgressDonut
                value={`${today?.gamesCompletedToday ?? today?.completedCount ?? 0} / ${today?.totalCount ?? 0}`}
                progress={(today?.totalCount ?? 0) > 0 ? (today?.gamesCompletedToday ?? today?.completedCount ?? 0) / (today?.totalCount ?? 1) : 0}
                color={String(theme.primary)}
                accessibilityLabel="Прогресс игр сегодня"
              />
            </View>
            <View style={[styles.activityDivider, { backgroundColor: theme.border }]} />
            <View style={styles.activityItem}>
              <View style={styles.activityInfo}>
                <View style={[styles.activityIconMonthly, theme.mode === "dark" && { backgroundColor: "#2D294A" }]}>
                  <Ionicons name="calendar-outline" size={21} color={theme.mode === "dark" ? "#B9A5FF" : "#7A5AF8"} />
                </View>
                <View style={styles.activityCopy}>
                  <AppText style={styles.activityTitle}>Челленджей за месяц</AppText>
                </View>
              </View>
              <ProgressDonut
                value={String(today?.monthlyChallengeCount ?? 0)}
                progress={Math.min(1, (today?.monthlyChallengeCount ?? 0) / 12)}
                color={theme.mode === "dark" ? "#B9A5FF" : "#7A5AF8"}
                accessibilityLabel="Челленджи за месяц"
              />
            </View>
          </GlassSurface>
        </GlassSurface>
      </View>

      <ProfileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSettings={() => router.push("/settings")}
        onInvite={() => router.push("/invite")}
      />
      {leaderboardOpen ? <LeaderboardModal visible onClose={() => setLeaderboardOpen(false)} /> : null}
      {inboxOpen ? <NotificationInbox onClose={() => setInboxOpen(false)} /> : null}
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
  },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    zIndex: 20,
  },
  headerSide: { flex: 1, alignItems: "flex-start" },
  headerSideEnd: { alignItems: "flex-end" },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: -34,
    zIndex: 12,
  },
  dashboard: {
    width: "100%",
  },
  dashboardDesktop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    paddingTop: 6,
  },
  hero: {
    width: "100%",
  },
  rankingPress: { alignSelf: "center", zIndex: 20 },
  rankingPill: { minHeight: 48, borderRadius: 24, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  rankingFaces: { minWidth: 54, flexDirection: "row", alignItems: "center", paddingLeft: 2 },
  rankingFace: { width: 28, height: 28, marginLeft: -10, borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
  heroDesktop: {
    flex: 1,
    minWidth: 0,
  },
  action: {
    flex: 1,
    minHeight: 64,
  },
  activityStrip: { minHeight: 108, marginTop: 12, borderRadius: 26, paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", borderWidth: 1 },
  activityItem: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 8 },
  activityInfo: { flex: 1, minWidth: 0, flexDirection: "column", alignItems: "flex-start", gap: 6 },
  activityIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  activityIconMonthly: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#EFE6FF" },
  activityCopy: { flex: 0, width: "100%", minWidth: 0, maxWidth: 82, alignItems: "flex-start", gap: 2 },
  activityTitle: { maxWidth: 82, fontSize: 12, lineHeight: 16, fontWeight: "800", textAlign: "left", flexShrink: 1 },
  donut: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  donutValue: { position: "absolute", fontSize: 14, lineHeight: 18, fontWeight: "900" },
  activityDivider: { width: 1, height: 64, marginHorizontal: 8 },
  tasksPanel: {
    borderRadius: 34,
    padding: 14,
    marginTop: 16,
    gap: 10,
  },
  tasksPanelDesktop: {
    flex: 1,
    minWidth: 0,
    marginTop: 10,
    padding: 18,
  },
  taskList: {
    gap: 9,
  },
});
