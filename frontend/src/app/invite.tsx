import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Share, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
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
  const code = referral?.code ?? user.referralCode ?? "LOGIC-7Q2M";
  const inviteUrl =
    referral?.link ?? `https://logic-coin.app/invite/${code}`;

  const share = () =>
    Share.share({
      title: "Logic Coin",
      message: `Logic Coin · ${code}\n${inviteUrl}`,
      url: inviteUrl,
    });

  return (
    <AppFrame>
      <ScreenHeader
        title={t("invite.title")}
        subtitle={t("invite.subtitle")}
        onBack={() => router.back()}
      />

      <LinearGradient
        colors={["#0866FF", "#4B49E8", "#7A5AF8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { shadowColor: theme.primary }]}
      >
        <View style={styles.people}>
          {["A", "L", "M"].map((letter, index) => (
            <View
              key={letter}
              style={[
                styles.person,
                {
                  marginLeft: index ? -12 : 0,
                  backgroundColor: ["#50BAFF", "#FFB84D", "#EC4899"][index],
                },
              ]}
            >
              <AppText variant="label" color="#FFFFFF">
                {letter}
              </AppText>
            </View>
          ))}
          <View style={[styles.person, styles.addPerson]}>
            <Ionicons name="add" color="#FFFFFF" size={20} />
          </View>
        </View>
        <AppText variant="title" color="#FFFFFF" style={{ textAlign: "center" }}>
          Logic is better together
        </AppText>
        <AppText color="rgba(255,255,255,0.75)" style={{ textAlign: "center" }}>
          {t("invite.subtitle")}
        </AppText>
      </LinearGradient>

      <View
        style={[
          styles.codeCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
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
          onPress={() => void Clipboard.setStringAsync(code)}
        >
          {t("invite.copy")}
        </AppButton>
        <AppButton icon="share-social-outline" glow onPress={() => void share()}>
          {t("invite.share")}
        </AppButton>
      </View>

      <View style={styles.stats}>
        <View
          style={[
            styles.stat,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.statIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons
              name="people"
              size={22}
              color={String(theme.primary)}
            />
          </View>
          <AppText variant="title">
            {referral?.invitedCount ?? (authenticated ? 0 : 3)}
          </AppText>
          <AppText variant="caption" muted>
            {t("invite.invited")}
          </AppText>
        </View>
        <View
          style={[
            styles.stat,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.statIcon, { backgroundColor: "#ECFDF3" }]}>
            <Ionicons
              name="trending-up"
              size={22}
              color={String(theme.success)}
            />
          </View>
          <AppText variant="title">
            {referral?.earnedUnits ?? (authenticated ? 0 : 124)} LC
          </AppText>
          <AppText variant="caption" muted>
            {t("invite.reward")}
          </AppText>
        </View>
      </View>

      <View
        style={[
          styles.info,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={[styles.infoIcon, { backgroundColor: theme.primarySoft }]}>
          <Ionicons
            name="information-circle"
            size={23}
            color={String(theme.primary)}
          />
        </View>
        <AppText variant="caption" muted style={{ flex: 1 }}>
          2% от подтверждённых наград друзей начисляются вам как реферальный
          бонус. Баланс друга не уменьшается.
        </AppText>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radii.xl,
    padding: 24,
    alignItems: "center",
    gap: 8,
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
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
    backgroundColor: "rgba(255,255,255,0.18)",
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
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
