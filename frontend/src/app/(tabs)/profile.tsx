import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { CountryFlagBadge, countryName } from "@/components/country-flag";
import { AppButton, IconButton } from "@/components/buttons";
import { EditProfileModal } from "@/components/edit-profile-modal";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenHeader } from "@/components/screen-header";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useChallenges } from "@/hooks/use-challenges";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTranslation } from "@/hooks/use-translation";
import { authApi, referralsApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { sharePublicProfile } from "@/lib/profile-link";
import { useAppStore } from "@/store/app-store";

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveLayout();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const user = useAppStore((state) => state.user);
  const balance = useAppStore((state) => state.balanceUnits);
  const coinBalance = useAppStore((state) => state.coinBalance);
  const todayChallengesCompleted = useAppStore((state) => state.todayChallengesCompleted);
  const { today } = useChallenges();
  const monthlyChallengeCount = today?.monthlyChallengeCount ?? 0;
  const gamesCompletedToday = today?.gamesCompletedToday ?? todayChallengesCompleted;
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
  const referral = referralQuery.data;
  const friendCount = authenticated ? referral?.invitedCount ?? 0 : 0;
  const referralCode = authenticated ? referral?.code ?? user.referralCode ?? "—" : "—";

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
            <Avatar name={user.name} avatarUrl={user.avatarUrl} size={84} />
            <View style={styles.identity}>
              <AppText variant="title">{user.name}</AppText>
              <AppText muted>{user.email ?? "Telegram"}</AppText>
              <View style={styles.countryLine}>
                <CountryFlagBadge countryCode={user.countryCode} size={18} />
                <AppText variant="caption" muted>{countryName(user.countryCode, useAppStore.getState().language ?? "ru")}</AppText>
              </View>
            </View>
            <View style={styles.editButton}>
              <IconButton name="create-outline" label={t("profile.edit")} onPress={() => setEditing(true)} />
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
                icon: "diamond-outline" as const,
                label: "coin",
                value: String(coinBalance),
                color: "#7A5AF8",
              },
              {
                icon: "people-outline" as const,
                label: t("profile.friends"),
                value: String(friendCount),
                color: "#7A5AF8",
              },
              {
                icon: "game-controller-outline" as const,
                label: "Игр сегодня",
                value: String(gamesCompletedToday),
                color: String(theme.primary),
              },
              {
                icon: "calendar-outline" as const,
                label: "Челленджей за месяц",
                value: String(monthlyChallengeCount),
                color: String(theme.success),
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
              {referralCode} ·{" "}
              {friendCount}{" "}
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
        <AppButton variant="secondary" icon="share-social-outline" onPress={() => void sharePublicProfile(user.name, user.referralCode)}>Поделиться профилем</AppButton>
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
      <EditProfileModal visible={editing} onClose={() => setEditing(false)} />
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    position: "relative",
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
    paddingRight: 50,
  },
  countryLine: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4 },
  editButton: { position: "absolute", top: 14, right: 14 },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 14,
  },
  stat: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 100,
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
