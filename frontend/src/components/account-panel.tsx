import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { AppButton } from "@/components/buttons";
import { EditProfileModal } from "@/components/edit-profile-modal";
import { GlassSurface } from "@/components/glass-surface";
import { MotionEntrance } from "@/components/motion-entrance";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useChallenges } from "@/hooks/use-challenges";
import { useReferrals } from "@/hooks/use-referrals";
import { useAccountCopy } from "@/lib/account-copy";
import { authApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { sharePublicProfile } from "@/lib/profile-link";
import { useAppStore } from "@/store/app-store";
export function AccountPanel() {
  const theme = useAppTheme(),
    router = useRouter(),
    c = useAccountCopy();
  const [editing, setEditing] = useState(false);
  const user = useAppStore((s) => s.user),
    balance = useAppStore((s) => s.balanceUnits);
  const { today } = useChallenges();
  const referrals = useReferrals();
  const tiles = [
    {
      label: c.balance,
      value: formatMoney(balance),
      icon: "wallet-outline" as const,
      route: "/balance",
    },
    {
      label: c.friends,
      value: String(referrals.data?.invitedCount ?? 0),
      icon: "people-outline" as const,
      route: "/friends",
    },
    {
      label: c.games,
      value: String(today?.gamesCompletedToday ?? 0),
      icon: "game-controller-outline" as const,
      route: "/activity?period=today",
    },
    {
      label: c.challenges,
      value: String(today?.monthlyChallengeCount ?? 0),
      icon: "trophy-outline" as const,
      route: "/activity?mode=challenge",
    },
  ];
  return (
    <View style={{ gap: 14, marginBottom: 20 }}>
      <MotionEntrance>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/invite")}
          style={({ pressed }) => ({
            backgroundColor: theme.primary,
            borderRadius: 24,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Ionicons
            name="gift-outline"
            size={30}
            color={String(theme.onPrimary)}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="heading" color={String(theme.onPrimary)}>
              {c.invite}
            </AppText>
            <AppText variant="caption" color={String(theme.onPrimary)}>
              {c.inviteHint}
            </AppText>
          </View>
          <Ionicons
            name="arrow-forward"
            size={23}
            color={String(theme.onPrimary)}
          />
        </Pressable>
      </MotionEntrance>
      <MotionEntrance>
        <GlassSurface
          variant="strong"
          style={{
            padding: 20,
            borderRadius: 24,
            flexDirection: "row",
            gap: 16,
            alignItems: "center",
          }}
        >
          <Avatar name={user.name} avatarUrl={user.avatarUrl} size={74} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="heading">{user.name}</AppText>
            {user.username ? (
              <AppText color={String(theme.primary)}> @{user.username}</AppText>
            ) : null}
            <AppText variant="caption" muted numberOfLines={1}>
              {user.email}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.edit}
            onPress={() => setEditing(true)}
            style={{ padding: 12 }}
          >
            <Ionicons
              name="create-outline"
              size={25}
              color={String(theme.primary)}
            />
          </Pressable>
        </GlassSurface>
      </MotionEntrance>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {tiles.map((tile) => (
          <MotionEntrance
            key={tile.route}
            style={{ width: "48%", flexGrow: 1 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tile.label}
              onPress={() => router.push(tile.route as never)}
              style={({ pressed }) => ({
                padding: 18,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: pressed ? theme.primarySoft : theme.surface,
                minHeight: 132,
                gap: 9,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Ionicons
                  name={tile.icon}
                  size={25}
                  color={String(theme.primary)}
                />
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={String(theme.textMuted)}
                />
              </View>
              <AppText variant="heading">{tile.value}</AppText>
              <AppText muted>{tile.label}</AppText>
            </Pressable>
          </MotionEntrance>
        ))}
      </View>
      <EditProfileModal visible={editing} onClose={() => setEditing(false)} />
    </View>
  );
}
export function AccountActions() {
  const c = useAccountCopy(),
    router = useRouter(),
    client = useQueryClient();
  const user = useAppStore((s) => s.user),
    token = useAppStore((s) => s.accessToken),
    refreshToken = useAppStore((s) => s.refreshToken),
    logout = useAppStore((s) => s.logout);
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (token) await authApi.logout(token, refreshToken).catch(() => {});
      client.removeQueries();
      logout();
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 10, marginTop: 20 }}>
      <AppButton
        variant="secondary"
        icon="share-social-outline"
        onPress={() => void sharePublicProfile(user.name, user.referralCode)}
      >
        {c.share}
      </AppButton>
      <AppButton
        variant="ghost"
        icon="log-out-outline"
        disabled={busy}
        onPress={() => void signOut()}
      >
        {c.logout}
      </AppButton>
    </View>
  );
}
