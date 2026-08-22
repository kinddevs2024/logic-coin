import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { Share, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenHeader } from "@/components/screen-header";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { referralsApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export default function InviteScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const user = useAppStore((state) => state.user);
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const authenticated = authMode === "authenticated" && Boolean(accessToken);
  const referralQuery = useQuery({
    queryKey: ["referrals", accessToken],
    queryFn: () => referralsApi.overview(accessToken!),
    enabled: authenticated,
    staleTime: 30_000,
  });
  const referral = referralQuery.data;
  const friends = referral?.friends ?? [];
  const code = authenticated ? referral?.code ?? user.referralCode ?? "—" : "—";
  const inviteUrl = authenticated
    ? referral?.link ?? (code !== "—" ? `https://logic-coin.app/invite/${code}` : "")
    : "";

  const share = () => {
    if (!authenticated || !inviteUrl) {
      router.push("/login");
      return;
    }
    void Share.share({
      title: "Logic Coin",
      message: `Logic Coin · ${code}\n${inviteUrl}`,
      url: inviteUrl,
    });
  };

  return (
    <AppFrame>
      <ScreenHeader
        title={t("invite.title")}
        subtitle={t("invite.subtitle")}
        onBack={() => router.back()}
      />

      <GlassSurface intensity={84} variant="strong" style={styles.hero}>
        <View style={styles.people}>
          {friends.slice(0, 3).map((friend, index) => (
            <View
              key={friend.id}
              style={[
                {
                  marginLeft: index ? -12 : 0,
                },
              ]}
            >
              <Avatar name={friend.name} avatarUrl={friend.avatarUrl} size={48} />
            </View>
          ))}
          <View
            style={[
              styles.person,
              styles.addPerson,
              { backgroundColor: theme.primary },
            ]}
          >
            <Ionicons name="add" color="#FFFFFF" size={20} />
          </View>
        </View>
        <AppText
          variant="title"
          color={String(theme.primary)}
          style={{ textAlign: "center" }}
        >
          Logic is better together
        </AppText>
        <AppText muted style={{ textAlign: "center" }}>
          {t("invite.subtitle")}
        </AppText>
      </GlassSurface>

      <GlassSurface intensity={68} style={styles.codeCard}>
        <AppText variant="caption" muted>
          {t("invite.code")}
        </AppText>
        <View style={styles.codeRow}>
          <AppText
            variant="title"
            color={String(theme.primary)}
            style={{ letterSpacing: 2 }}
          >
            {code}
          </AppText>
          <View
            style={[styles.qrHint, { backgroundColor: theme.primarySoft }]}
          >
            <Ionicons
              name="qr-code-outline"
              size={25}
              color={String(theme.primary)}
            />
          </View>
        </View>
        <AppButton
          variant="secondary"
          icon="copy-outline"
          onPress={() => authenticated && code !== "—" ? void Clipboard.setStringAsync(code) : router.push("/login")}
        >
          {t("invite.copy")}
        </AppButton>
        <AppButton icon="share-social-outline" glow onPress={share}>
          {t("invite.share")}
        </AppButton>
      </GlassSurface>

      <View style={styles.stats}>
        <GlassSurface variant="soft" intensity={56} style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons
              name="people"
              size={22}
              color={String(theme.primary)}
            />
          </View>
          <AppText variant="title">
            {authenticated ? referral?.invitedCount ?? 0 : 0}
          </AppText>
          <AppText variant="caption" muted>
            {t("invite.invited")}
          </AppText>
        </GlassSurface>
        <GlassSurface variant="soft" intensity={56} style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: "#ECFDF3" }]}>
            <Ionicons
              name="trending-up"
              size={22}
              color={String(theme.success)}
            />
          </View>
          <AppText variant="title">
            {authenticated ? referral?.earnedUnits ?? 0 : 0} LC · {authenticated ? referral?.earnedCoins ?? 0 : 0} coin
          </AppText>
          <AppText variant="caption" muted>
            {t("invite.reward")}
          </AppText>
        </GlassSurface>
      </View>

      {friends.length ? (
        <GlassSurface intensity={58} variant="soft" style={styles.friendList}>
          {friends.slice(0, 6).map((friend) => (
            <View key={friend.id} style={styles.friendRow}>
              <Avatar name={friend.name} avatarUrl={friend.avatarUrl} size={40} />
              <AppText variant="label" style={{ flex: 1 }}>{friend.name}</AppText>
              {friend.verified ? <Ionicons name="checkmark-circle" size={18} color={String(theme.success)} /> : null}
            </View>
          ))}
        </GlassSurface>
      ) : null}

      <GlassSurface variant="soft" intensity={58} style={styles.info}>
        <View style={[styles.infoIcon, { backgroundColor: theme.primarySoft }]}>
          <Ionicons
            name="information-circle"
            size={23}
            color={String(theme.primary)}
          />
        </View>
        <AppText variant="caption" muted style={{ flex: 1 }}>
          25% от денежных и coin-призов приглашённых друзей начисляются вам.
          Баланс друга не уменьшается.
        </AppText>
      </GlassSurface>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radii.xl,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  people: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  person: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  addPerson: {
    marginLeft: -12,
  },
  codeCard: {
    marginTop: 16,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  qrHint: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 15,
    gap: 5,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  info: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  friendList: { marginTop: 14, borderRadius: radii.lg, padding: 10, gap: 5 },
  friendRow: { minHeight: 48, borderRadius: 16, paddingHorizontal: 7, flexDirection: "row", alignItems: "center", gap: 10 },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
