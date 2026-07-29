import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ActivityHeatmap } from "@/components/activity-heatmap";
import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { AppButton, IconButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenHeader } from "@/components/screen-header";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTranslation } from "@/hooks/use-translation";
import { activityApi, authApi, referralsApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useAppStore } from "@/store/app-store";

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { t, language } = useTranslation();
  const { isDesktop } = useResponsiveLayout();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAppStore((state) => state.user);
  const balance = useAppStore((state) => state.balanceUnits);
  const activeDays = useAppStore((state) => state.activeDays);
  const streak = useAppStore((state) => state.streak);
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const refreshToken = useAppStore((state) => state.refreshToken);
  const logout = useAppStore((state) => state.logout);
  const authenticated = authMode === "authenticated" && Boolean(accessToken);
  const referralQuery = useQuery({
    queryKey: ["referrals", accessToken],
    queryFn: () => referralsApi.overview(accessToken!),
    enabled: authenticated,
    staleTime: 30_000,
  });
  const activityQuery = useQuery({
    queryKey: ["activity", "profile", accessToken],
    queryFn: () => activityApi.list(accessToken!),
    enabled: authenticated,
    staleTime: 30_000,
  });
  const referral = referralQuery.data;
  const activity = activityQuery.data;

  const signOut = async () => {
    if (authenticated) {
      await authApi.logout(accessToken!, refreshToken).catch(() => {});
    }
    queryClient.removeQueries();
    logout();
    router.replace("/login");
  };

  return (
    <AppFrame wide desktopNavigationInset>
      <ScreenHeader
        title={t("profile.title")}
        action={
          <IconButton
            name="settings-outline"
            label={t("profile.settings")}
            onPress={() => router.push("/settings")}
          />
        }
      />

      <View style={[styles.profileGrid, isDesktop && styles.profileGridDesktop]}>
        <View style={styles.summaryColumn}>
          <GlassSurface
            intensity={82}
            variant="strong"
            style={styles.profileCard}
          >
            <Avatar name={user.name} size={84} />
            <View style={styles.identity}>
              <AppText variant="title">{user.name}</AppText>
              <AppText muted>{user.email ?? t("common.demo")}</AppText>
              <View
                style={[
                  styles.language,
                  { backgroundColor: theme.primarySoft },
                ]}
              >
                <Ionicons
                  name="globe-outline"
                  size={14}
                  color={String(theme.primary)}
                />
                <AppText variant="caption" color={String(theme.primary)}>
                  {language.toUpperCase()}
                </AppText>
              </View>
            </View>
          </GlassSurface>

          <View style={styles.stats}>
            {[
              {
                icon: "wallet-outline" as const,
                label: t("profile.balance"),
                value: formatMoney(balance),
                color: String(theme.primary),
              },
              {
                icon: "calendar-outline" as const,
                label: t("home.drawer.activeDays"),
                value: String(activity?.totalActiveDays ?? activeDays),
                color: String(theme.success),
              },
              {
                icon: "people-outline" as const,
                label: t("profile.friends"),
                value: String(
                  referral?.invitedCount ?? (authenticated ? 0 : 3),
                ),
                color: "#7A5AF8",
              },
            ].map((stat) => (
              <GlassSurface
                key={stat.label}
                variant="soft"
                intensity={54}
                style={styles.stat}
              >
                <Ionicons name={stat.icon} size={19} color={stat.color} />
                <AppText variant="heading">{stat.value}</AppText>
                <AppText
                  variant="caption"
                  muted
                  style={{ textAlign: "center" }}
                >
                  {stat.label}
                </AppText>
              </GlassSurface>
            ))}
          </View>
        </View>

        <GlassSurface
          intensity={68}
          style={[styles.activity, isDesktop && styles.activityDesktop]}
        >
          <View style={styles.activityHeader}>
            <View>
              <AppText variant="heading">{t("profile.active")}</AppText>
              <AppText variant="caption" muted>
                {activity?.totalActiveDays ?? activeDays}{" "}
                {t("home.drawer.activeDays")}
              </AppText>
            </View>
            <View
              style={[
                styles.streakBadge,
                { backgroundColor: theme.primarySoft },
              ]}
            >
              <Ionicons name="flame" size={16} color={String(theme.primary)} />
              <AppText variant="caption" color={String(theme.primary)}>
                {activity?.streak.activeDays ?? streak}
              </AppText>
            </View>
          </View>
          <View style={styles.heatmapScroll}>
            <ActivityHeatmap days={activity?.days} toDayKey={activity?.to} />
          </View>
        </GlassSurface>
      </View>

      <GlassSurface intensity={62} style={styles.referralSurface}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("profile.invite")}
          onPress={() => router.push("/invite")}
          style={({ pressed }) => [
            styles.referral,
            { opacity: pressed ? 0.78 : 1 },
          ]}
        >
          <View style={[styles.refIcon, { backgroundColor: "#F2EFFF" }]}>
            <Ionicons name="gift" size={24} color="#7A5AF8" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="label">{t("profile.invite")}</AppText>
            <AppText variant="caption" muted>
              {referral?.code ?? user.referralCode ?? "LOGIC-7Q2M"} ·{" "}
              {referral?.invitedCount ?? (authenticated ? 0 : 3)}{" "}
              {t("invite.people")}
            </AppText>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={String(theme.textMuted)}
          />
        </Pressable>
      </GlassSurface>

      <View style={styles.actions}>
        <AppButton
          variant="secondary"
          icon="settings-outline"
          onPress={() => router.push("/settings")}
        >
          {t("profile.settings")}
        </AppButton>
        <AppButton
          variant="ghost"
          icon="log-out-outline"
          onPress={() => void signOut()}
        >
          {t("profile.logout")}
        </AppButton>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    borderRadius: radii.xl,
    padding: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  profileGrid: {
    width: "100%",
  },
  profileGridDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 18,
  },
  summaryColumn: {
    flex: 1,
    minWidth: 0,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  language: {
    marginTop: 7,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  stats: {
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
  },
  stat: {
    flex: 1,
    minHeight: 116,
    borderWidth: 1,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 8,
  },
  activity: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: 18,
    gap: 18,
  },
  activityDesktop: {
    flex: 1,
    minWidth: 0,
    marginTop: 0,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streakBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    gap: 5,
  },
  heatmapScroll: {
    minWidth: 205,
    alignItems: "center",
  },
  referralSurface: {
    marginTop: 14,
    borderRadius: radii.lg,
  },
  referral: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  refIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    marginTop: 16,
    gap: 8,
  },
});
