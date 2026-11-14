import { HomeActivityBlocks } from "@/components/home-activity-blocks";
import { RaffleBanner } from "@/components/raffle-banner";
import { useUiCopy } from "@/components/localized-native";

import { HomeTutorial } from "@/components/home-tutorial";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RankingPreview } from "@/components/ranking-preview";
import Svg, { Circle } from "react-native-svg";
import { Pressable, StyleSheet, View, ScrollView, Platform } from "react-native";

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
  const { copyText, copyContent } = useUiCopy();
  const size = 56;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0) * circumference;
  return (
    <View accessible accessibilityLabel={copyText(accessibilityLabel)} style={styles.donut}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={`${color}30`} strokeWidth={strokeWidth} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${circumference - dash}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <AppText style={[styles.donutValue, { color }]}>{copyContent(value)}</AppText>
    </View>
  );
}

export default function HomeScreen() {
  const { copyText, copyContent } = useUiCopy();
  const theme = useAppTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const { isDesktop } = useResponsiveLayout();
  const jarTarget = useRef<View>(null);
  const challengesTarget = useRef<View>(null);
  const rankingTarget = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const [tourActive, setTourActive] = useState(true);
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
      await Promise.all(["bootstrap", "challenges", "leaderboard", "home-activity", "unread-count"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    } finally { setRefreshing(false); }
  };
  const balance = useAppStore((state) => state.balanceUnits);
  const goal = useAppStore((state) => state.goalUnits);
  const user = useAppStore((state) => state.user);
  const { today, pendingGameKey } = useChallenges();

  return (<>
    <AppFrame wide desktopNavigationInset fixedHeader={
      <View pointerEvents={Platform.OS === "web" ? "none" : "box-none"} testID="home-fixed-header" style={styles.header}>
        <View pointerEvents={Platform.OS === "web" ? "none" : "box-none"} style={styles.headerSide}>
          <Pressable pointerEvents="auto" accessibilityRole="button" accessibilityLabel={copyText(t("tabs.profile"))} onPress={() => setDrawerOpen(true)}><Avatar userId={user.id} name={user.name} avatarUrl={user.avatarUrl} size={44} /></Pressable>
        </View>
        <View pointerEvents="auto" ref={rankingTarget} collapsable={false}><RankingPreview metric="yesterday" onPress={() => setLeaderboardOpen(true)} /></View>
        <View pointerEvents={Platform.OS === "web" ? "none" : "box-none"} style={[styles.headerSide, styles.headerSideEnd]}>
          <View pointerEvents="auto" ref={inboxButton} collapsable={false}><HomeBell
            onPress={() => {
              inboxButton.current?.measureInWindow((x, y, width, height) => {
                setInboxAnchor({ x, y, width, height });
                setInboxOpen(true);
              });
            }}
          /></View>
        </View>
      </View>
    } contentStyle={styles.content} scrollRef={scrollRef} scrollProps={{ scrollEnabled: !tourActive, scrollEventThrottle: 16, onScroll: ({ nativeEvent }) => {
      scrollY.current = nativeEvent.contentOffset.y;
      const scene = giftScene.current;
      setGiftSceneVisible(nativeEvent.contentOffset.y < scene.top + scene.height * 0.82);
    } }} onOpenProfile={() => setDrawerOpen(true)} onSwipeRefresh={() => void refreshHome()} swipesDisabled={tourActive || drawerOpen || leaderboardOpen || inboxOpen}>


      {refreshing ? <AppText accessibilityLiveRegion="polite" muted>{copyText("Обновляем…")}</AppText> : null}

      {!tourActive ? <HomeDesktopAds position="top" /> : null}
      <View onLayout={({ nativeEvent: { layout } }) => { giftScene.current.top = layout.y; }} style={[styles.dashboard, isDesktop && styles.dashboardDesktop, Platform.OS === "web" && isDesktop && { alignItems: "flex-start" }]}>
        <View ref={jarTarget} collapsable={false} onLayout={({ nativeEvent: { layout } }) => {
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
                {copyContent(t("home.earn"))}
              </AppButton>
              <AppButton
                icon="wallet"
                onPress={() => router.push("/withdraw")}
                glow
                style={styles.action}
              >
                {copyContent(t("home.withdraw"))}
              </AppButton>
            </View>
          </SavingsScene>
          <View collapsable={false} pointerEvents={Platform.OS === "web" ? "none" : "box-none"} style={StyleSheet.absoluteFill}>
            <FloatingHomeGift key="bank-attached-gift" active={!tourActive && giftSceneVisible && !drawerOpen && !leaderboardOpen && !inboxOpen && !activityInfoOpen} bounds={giftBounds} />
          </View>
        </View>

        <RaffleBanner />
        <View style={isDesktop ? { flex: 1, minWidth: 0 } : { width: "100%", marginTop: Platform.OS === "web" ? 18 : 0 }}><HomeActivityBlocks today={today} pendingGameKey={pendingGameKey} challengesTarget={challengesTarget} /></View>
      </View>

      {!tourActive ? <HomeDesktopAds position="bottom" /> : null}

      <HomeTutorial targets={[jarTarget, challengesTarget, rankingTarget]} scrollRef={scrollRef} scrollY={scrollY} onActiveChange={setTourActive} />
      <ProfileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSettings={() => router.push("/settings")}
        onInvite={() => router.push("/invite")}
      />
      {activityInfoOpen ? <MonthlyActivityInfo period={activityInfoOpen} onClose={() => setActivityInfoOpen(null)} /> : null}
      {leaderboardOpen ? <LeaderboardModal visible onClose={() => setLeaderboardOpen(false)} /> : null}
      {inboxOpen ? <NotificationInbox anchor={inboxAnchor} anchorRef={inboxButton} onClose={() => setInboxOpen(false)} /> : null}
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
  activityItem: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, paddingHorizontal: 4 },
  activityTitle: { minWidth: 0, fontSize: 12, lineHeight: 16, fontWeight: "800", textAlign: "left" },
  activityLabelRow: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center", gap: 4 },
  donut: { width: 56, height: 56, flexShrink: 0, alignItems: "center", justifyContent: "center" },
  donutValue: { position: "absolute", fontSize: 14, lineHeight: 18, fontWeight: "900" },
  activityDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginHorizontal: 4 },
  tasksPanel: {
    borderRadius: 34,
    padding: 14,
    marginTop: 10,
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
