import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppButton, IconButton } from "@/components/buttons";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { ChallengeCard } from "@/components/challenge-card";
import { ChallengeEmptyState } from "@/components/challenge-empty-state";
import { GlassSurface } from "@/components/glass-surface";
import { LeaderboardModal } from "@/components/leaderboard-modal";
import { ProfileDrawer } from "@/components/profile-drawer";
import { SavingsScene } from "@/components/savings-scene";
import { SectionHeader } from "@/components/section-header";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useChallenges } from "@/hooks/use-challenges";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";

export default function HomeScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isDesktop } = useResponsiveLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const balance = useAppStore((state) => state.balanceUnits);
  const goal = useAppStore((state) => state.goalUnits);
  const user = useAppStore((state) => state.user);
  const { today, pendingGameKey } = useChallenges();

  return (
    <AppFrame wide desktopNavigationInset contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <IconButton
            name="person-outline"
            label={t("tabs.profile")}
            onPress={() => setDrawerOpen(true)}
          />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Рейтинг" onPress={() => setLeaderboardOpen(true)} style={({ pressed }) => [styles.rankingPress, pressed && { opacity: 0.76 }]}>
          <GlassSurface intensity={66} variant="strong" style={styles.rankingPill}>
            <View style={styles.rankingFaces}>
              <Avatar name={user.name} avatarUrl={user.avatarUrl} size={28} />
              <View style={[styles.rankingFace, { backgroundColor: "#DDEBFF" }]}><Ionicons name="person" size={13} color="#3978D4" /></View>
              <View style={[styles.rankingFace, { backgroundColor: "#EFE6FF" }]}><Ionicons name="person" size={13} color="#7A5AF8" /></View>
            </View>
            <Ionicons name="trophy" size={19} color={String(theme.primary)} />
          </GlassSurface>
        </Pressable>
        <View style={[styles.headerSide, styles.headerSideEnd]}>
          <IconButton
            name="settings-outline"
            label={t("profile.settings")}
            onPress={() => router.push("/settings")}
          />
        </View>
      </View>

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
          <GlassSurface intensity={58} variant="soft" style={styles.activityStrip}>
            <View style={styles.activityItem}>
              <Ionicons name="game-controller-outline" size={18} color={String(theme.primary)} />
              <View><AppText variant="heading">{today?.gamesCompletedToday ?? today?.completedCount ?? 0}</AppText><AppText variant="caption" muted>игр сегодня</AppText></View>
            </View>
            <View style={[styles.activityDivider, { backgroundColor: theme.border }]} />
            <View style={styles.activityItem}>
              <Ionicons name="calendar-outline" size={18} color="#7A5AF8" />
              <View><AppText variant="heading">{today?.monthlyChallengeCount ?? 0}</AppText><AppText variant="caption" muted>челленджей за месяц</AppText></View>
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
      <LeaderboardModal visible={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
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
  activityStrip: { minHeight: 76, marginTop: 12, borderRadius: 26, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" },
  activityItem: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  activityDivider: { width: 1, height: 36, marginHorizontal: 10 },
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
