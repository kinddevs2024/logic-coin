import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RankingPreview } from "@/components/ranking-preview";
import Svg, { Circle } from "react-native-svg";
import { Pressable, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { HomeDesktopAds } from "@/components/home-desktop-ads";
import { AppButton } from "@/components/buttons";
import { HomeBell } from "@/components/home-bell";
import { FloatingHomeGift } from "@/components/floating-home-gift";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { ChallengeCard } from "@/components/challenge-card";
import { ChallengeEmptyState } from "@/components/challenge-empty-state";
import { GlassSurface } from "@/components/glass-surface";
import { LeaderboardModal } from "@/components/leaderboard-modal";
import { NotificationInbox } from "@/components/notification-inbox";
import { ProfileDrawer } from "@/components/profile-drawer";
import { SavingsScene } from "@/components/savings-scene";
import { HomeChallengeClock } from "@/components/home-challenge-clock";
import { MonthlyActivityInfo } from "@/components/monthly-activity-info";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useChallenges } from "@/hooks/use-challenges";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";
import { inboxApi } from "@/lib/api";

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
  const { t, language } = useTranslation();
  const router = useRouter();
  const { isDesktop } = useResponsiveLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [activityInfoOpen, setActivityInfoOpen] = useState<"week" | "month" | null>(null);
  const inboxButton = useRef<View>(null);
  const [giftBounds, setGiftBounds] = useState<{ top: number; bottom: number; width: number }>();
  const giftScene = useRef({ top: 0, height: 0 });
  const [giftSceneVisible, setGiftSceneVisible] = useState(true);
  const [inboxAnchor, setInboxAnchor] = useState<{ x: number; y: number; width: number; height: number }>();
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const inboxToken = useAppStore(state => state.accessToken);
  useEffect(() => {
    if (!inboxToken) return;
    void queryClient.prefetchInfiniteQuery({
      queryKey: ["inbox", inboxToken, true],
      initialPageParam: null as { date: string; id: string } | null,
      queryFn: ({ pageParam }) => inboxApi.list(inboxToken, true, pageParam),
      staleTime: 60_000,
    });
  }, [inboxToken, queryClient]);
  const refreshHome = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all(["bootstrap", "challenges", "leaderboard", "unread-count"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    } finally { setRefreshing(false); }
  };
  const balance = useAppStore((state) => state.balanceUnits);
  const goal = useAppStore((state) => state.goalUnits);
  const user = useAppStore((state) => state.user);
  const { today, pendingGameKey } = useChallenges();

  return (<>
    <AppFrame wide desktopNavigationInset contentStyle={styles.content} scrollProps={{ scrollEventThrottle: 100, onScroll: ({ nativeEvent }) => {
      const scene = giftScene.current;
      setGiftSceneVisible(nativeEvent.contentOffset.y < scene.top + scene.height * 0.82);
    } }} onOpenProfile={() => setDrawerOpen(true)} onSwipeRefresh={() => void refreshHome()} swipesDisabled={drawerOpen || leaderboardOpen || inboxOpen}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("tabs.profile")} onPress={() => setDrawerOpen(true)}><Avatar name={user.name} avatarUrl={user.avatarUrl} size={44} /></Pressable>
        </View>
        <RankingPreview metric="wealth" onPress={() => setLeaderboardOpen(true)} />
        <View style={[styles.headerSide, styles.headerSideEnd]}>
          <View ref={inboxButton} collapsable={false}><HomeBell
            onPress={() => {
              inboxButton.current?.measureInWindow((x, y, width, height) => {
                setInboxAnchor({ x, y, width, height });
                setInboxOpen(true);
              });
            }}
          /></View>
        </View>
      </View>

      {refreshing ? <AppText accessibilityLiveRegion="polite" muted>Обновляем…</AppText> : null}

      <HomeDesktopAds position="top" />
      <View onLayout={({ nativeEvent: { layout } }) => { giftScene.current.top = layout.y; }} style={[styles.dashboard, isDesktop && styles.dashboardDesktop]}>
        <View collapsable={false} onLayout={({ nativeEvent: { layout } }) => {
          giftScene.current.height = layout.height;
          setGiftBounds({ top: layout.height * 0.08, bottom: layout.height * 0.82, width: layout.width });
        }} style={[styles.hero, isDesktop && styles.heroDesktop]}>
          <SavingsScene balance={balance} goal={goal}>
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
          </SavingsScene>
          <View collapsable={false} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <FloatingHomeGift key="bank-attached-gift" active={giftSceneVisible && !drawerOpen && !leaderboardOpen && !inboxOpen && !activityInfoOpen} bounds={giftBounds} />
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
          <HomeChallengeClock
            endsAt={today?.endsAt}
            onPress={() => router.push("/challenges" as never)}
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
              <View style={styles.activityLabelRow}><AppText style={[styles.activityTitle, { maxWidth: "100%", flex: 1 }]}>{language === "uz" ? "Haftalik faollik" : language === "en" ? "Weekly activity" : "Недельная активность"}</AppText><Pressable hitSlop={6} accessibilityRole="button" accessibilityLabel={language === "uz" ? "Haftalik faollik haqida" : language === "en" ? "About weekly activity" : "О недельной активности"} onPress={() => setActivityInfoOpen("week")} style={styles.activityInfoButton}><Ionicons name="information-circle-outline" size={18} color={String(theme.textMuted)} /></Pressable></View>
              <ProgressDonut
                value={today?.weeklyCompletedDays === undefined ? "—" : `${today.weeklyCompletedDays}/7`}
                progress={(today?.weeklyCompletedDays ?? 0) / 7}
                color={String(theme.primary)}
                accessibilityLabel={language === "uz" ? "Haftada yopilgan kunlar" : language === "en" ? "Completed days this week" : "Завершённые дни за неделю"}
              />
            </View>
            <View style={[styles.activityDivider, { backgroundColor: theme.border }]} />
            <View style={styles.activityItem}>
              <View style={styles.activityLabelRow}><AppText style={[styles.activityTitle, { maxWidth: "100%", flex: 1 }]}>{language === "uz" ? "Oylik faollik" : language === "en" ? "Monthly activity" : "Месячная активность"}</AppText><Pressable hitSlop={6} accessibilityRole="button" accessibilityLabel={language === "uz" ? "Oylik faollik haqida" : language === "en" ? "About monthly activity" : "О месячной активности"} onPress={() => setActivityInfoOpen("month")} style={styles.activityInfoButton}><Ionicons name="information-circle-outline" size={18} color={String(theme.textMuted)} /></Pressable></View>
              <ProgressDonut
                value={today?.monthlyCompletedDays === undefined ? "—" : `${today.monthlyCompletedDays}/${today.monthlyDaysInMonth}`}
                progress={today?.monthlyDaysInMonth ? Math.min(1, (today.monthlyCompletedDays ?? 0) / today.monthlyDaysInMonth) : 0}
                color={theme.mode === "dark" ? "#B9A5FF" : "#7A5AF8"}
                  accessibilityLabel={language === "uz" ? "Oyda to‘liq yopilgan kunlar" : language === "en" ? "Fully completed challenge days this month" : "Полностью завершённые дни челленджа за месяц"}
              />
            </View>
          </GlassSurface>
        </GlassSurface>
      </View>

      <HomeDesktopAds position="bottom" />

      <ProfileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSettings={() => router.push("/settings")}
        onInvite={() => router.push("/invite")}
      />
      {activityInfoOpen ? <MonthlyActivityInfo period={activityInfoOpen} onClose={() => setActivityInfoOpen(null)} /> : null}
      {leaderboardOpen ? <LeaderboardModal visible onClose={() => setLeaderboardOpen(false)} /> : null}
      {inboxOpen ? <NotificationInbox anchor={inboxAnchor} onClose={() => setInboxOpen(false)} /> : null}
    </AppFrame>
  </>);
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
  activityStrip: { minHeight: 82, marginTop: 12, borderRadius: 22, paddingHorizontal: 6, paddingVertical: 8, flexDirection: "row", alignItems: "stretch", borderWidth: StyleSheet.hairlineWidth },
  activityItem: { flex: 1, minWidth: 0, flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 8, paddingHorizontal: 8 },
  activityTitle: { minWidth: 0, maxWidth: "58%", fontSize: 12, lineHeight: 16, fontWeight: "800", textAlign: "left", flexShrink: 1 },
  activityLabelRow: { width: "100%", minWidth: 0, minHeight: 32, flexDirection: "row", alignItems: "center", gap: 3 },
  activityInfoButton: { minHeight: 32, width: 24, flexShrink: 0, alignItems: "center", justifyContent: "center" },
  donut: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  donutValue: { position: "absolute", fontSize: 14, lineHeight: 18, fontWeight: "900" },
  activityDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginHorizontal: 4 },
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
