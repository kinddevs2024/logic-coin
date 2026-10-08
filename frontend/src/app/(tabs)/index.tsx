import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { HomeChampionshipStatus, HomePeriods, HomeSocialRules, useHomeOverview } from "@/components/home-championship";
import { HomeBell } from "@/components/home-bell";
import { useQueryClient } from "@tanstack/react-query";
import { RankingPreview } from "@/components/ranking-preview";
import { Pressable, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { HomeDesktopAds } from "@/components/home-desktop-ads";
import { AppButton } from "@/components/buttons";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { ChallengeCard } from "@/components/challenge-card";
import { ChallengeEmptyState } from "@/components/challenge-empty-state";
import { GlassSurface } from "@/components/glass-surface";
import { LeaderboardModal } from "@/components/leaderboard-modal";
import { NotificationInbox } from "@/components/notification-inbox";
import { ProfileDrawer } from "@/components/profile-drawer";
import { SavingsScene } from "@/components/savings-scene";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useChallenges } from "@/hooks/use-challenges";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";
import { inboxApi } from "@/lib/api";

export default function HomeScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isDesktop } = useResponsiveLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const inboxButton = useRef<View>(null);
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
      await Promise.all(["bootstrap", "challenges", "leaderboard", "home", "home-ad-offer", "unread-count"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    } finally { setRefreshing(false); }
  };
  const balance = useAppStore((state) => state.balanceUnits);
  const goal = useAppStore((state) => state.goalUnits);
  const user = useAppStore((state) => state.user);
  const { today, pendingGameKey } = useChallenges();
  const home = useHomeOverview();
  const { refetch: refetchHome } = home;
  const refreshOverview = useCallback(() => { void refetchHome(); }, [refetchHome]);

  return (
    <AppFrame wide desktopNavigationInset contentStyle={styles.content} onOpenProfile={() => setDrawerOpen(true)} onSwipeRefresh={() => void refreshHome()} swipesDisabled={drawerOpen || leaderboardOpen || inboxOpen}>
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
      <View style={[styles.dashboard, isDesktop && styles.dashboardDesktop]}>
        <View style={[styles.hero, isDesktop && styles.heroDesktop]}>
          <View pointerEvents="box-none" style={{ position: "absolute", top: 16, left: 0, right: 0, zIndex: 15 }}><HomeSocialRules data={home.data} /></View>
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
          {home.data ? <HomeChampionshipStatus data={home.data} receivedAt={home.dataUpdatedAt} refresh={refreshOverview} /> : <AppText muted>{home.isError ? "Не удалось загрузить" : "…"}</AppText>}
          {home.isError ? <Pressable accessibilityRole="button" onPress={refreshOverview}><AppText>Повторить</AppText></Pressable> : null}
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
            {home.data ? <HomePeriods data={home.data} /> : null}
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
      {leaderboardOpen ? <LeaderboardModal visible onClose={() => setLeaderboardOpen(false)} /> : null}
      {inboxOpen ? <NotificationInbox anchor={inboxAnchor} onClose={() => setInboxOpen(false)} /> : null}
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
  activityItem: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", gap: 8, paddingHorizontal: 8 },
  activityTitle: { minWidth: 0, maxWidth: "58%", fontSize: 12, lineHeight: 16, fontWeight: "800", textAlign: "left", flexShrink: 1 },
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
