import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
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
              <View style={styles.activityMetric}>
                <ProgressDonut
                  value={`${today?.gamesCompletedToday ?? today?.completedCount ?? 0} / ${today?.totalCount ?? 0}`}
                  progress={(today?.totalCount ?? 0) > 0 ? (today?.gamesCompletedToday ?? today?.completedCount ?? 0) / (today?.totalCount ?? 1) : 0}
                  color={String(theme.primary)}
                  accessibilityLabel="Прогресс игр сегодня"
                />
                <AppText variant="caption" muted>Игр сегодня</AppText>
              </View>
            </View>
            <View style={[styles.activityDivider, { backgroundColor: theme.border }]} />
            <View style={styles.activityItem}>
              <View style={styles.activityMetric}>
                <ProgressDonut
                  value={String(today?.monthlyChallengeCount ?? 0)}
                  progress={Math.min(1, (today?.monthlyChallengeCount ?? 0) / 12)}
                  color="#7A5AF8"
                  accessibilityLabel="Челленджи за месяц"
                />
                <AppText variant="caption" muted>Челленджей за месяц</AppText>
              </View>
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
  activityStrip: { minHeight: 92, marginTop: 12, borderRadius: 26, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" },
  activityItem: { flex: 1, minWidth: 0, alignItems: "center" },
  activityMetric: { alignItems: "center", gap: 4 },
  donut: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  donutValue: { position: "absolute", fontSize: 14, lineHeight: 18, fontWeight: "900" },
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
