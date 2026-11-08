import { useAppStore } from "@/store/app-store";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable } from "react-native";
import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { Avatar } from "@/components/avatar";
import { ScreenHeader } from "@/components/screen-header";
import { MotionEntrance } from "@/components/motion-entrance";
import { useReferrals } from "@/hooks/use-referrals";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAccountCopy } from "@/lib/account-copy";
export default function FriendsScreen() {
  const token = useAppStore((s) => s.accessToken);
  const c = useAccountCopy(),
    router = useRouter(),
    theme = useAppTheme(),
    query = useReferrals();
  return (
    <AppFrame>
      <ScreenHeader
        title={c.friends}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/settings")
        }
      />
      <AppButton icon="gift-outline" onPress={() => router.push("/invite")}>
        {c.invite}
      </AppButton>
      <AppText variant="heading" style={{ marginVertical: 18 }}>
        {query.data?.invitedCount ?? 0} · {c.earned}: $
        {((query.data?.earnedCents ?? 0) / 100).toFixed(2)}
      </AppText>
      {!token ? (
        <AppButton onPress={() => router.push("/login")}>{c.login}</AppButton>
      ) : null}
      {token && query.isPending ? (
        <ActivityIndicator
          color={String(theme.primary)}
          style={{ margin: 20 }}
        />
      ) : null}
      {query.isError ? (
        <AppButton onPress={() => void query.refetch()}>{c.retry}</AppButton>
      ) : null}
      {!query.isPending && !query.data?.friends.length ? (
        <AppText muted>{c.empty}</AppText>
      ) : null}
      {query.data?.friends.map((f) => (
        <MotionEntrance
          key={f.id}
          style={{
            padding: 18,
            marginBottom: 12,
            borderRadius: 22,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            gap: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/player/${f.id}` as never)}
            style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
          >
            <Avatar userId={f.id} name={f.name} avatarUrl={f.avatarUrl} size={48} />
            <AppText variant="heading" style={{ flex: 1 }}>
              {f.name}
            </AppText>
          </Pressable>
          <AppText color={String(theme.primary)}>
            {c.earned}: ${((f.earnedCents ?? 0) / 100).toFixed(2)}
          </AppText>
          <AppText muted>
            {c.direct}: ${((f.directEarnedCents ?? 0) / 100).toFixed(2)} ·{" "}
            {c.indirect}: ${((f.indirectEarnedCents ?? 0) / 100).toFixed(2)}
          </AppText>
          <AppText muted>
            {c.invited}: {f.invitedCount ?? 0}
          </AppText>
        </MotionEntrance>
      ))}
      {query.hasNextPage ? (
        <AppButton
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        >
          {c.more}
        </AppButton>
      ) : null}
    </AppFrame>
  );
}
