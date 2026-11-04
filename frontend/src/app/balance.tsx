import { useAccountWallet } from "@/hooks/use-account-wallet";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { ScreenHeader } from "@/components/screen-header";
import { MotionEntrance } from "@/components/motion-entrance";
import { useAccountCopy } from "@/lib/account-copy";
import { authenticatedRequest } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { useAppTheme } from "@/hooks/use-app-theme";
type Entry = {
  id: string;
  type: string;
  amountCents: number;
  balanceAfterCents: number;
  description: string;
  createdAt: string;
};
export default function BalanceScreen() {
  const c = useAccountCopy(),
    router = useRouter(),
    theme = useAppTheme();
  const token = useAppStore((s) => s.accessToken),
    balance = useAppStore((s) => s.balanceUnits),
    coins = useAppStore((s) => s.coinBalance),
    language = useAppStore((s) => s.language) ?? "uz";
  const query = useInfiniteQuery({
    queryKey: ["account-ledger", token],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      authenticatedRequest<{ entries: Entry[]; nextCursor: string | null }>(
        `/wallet/ledger?limit=30${pageParam ? `&cursor=${pageParam}` : ""}`,
        { token: token! },
      ),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: Boolean(token),
  });
  const wallet = useAccountWallet();
  const entries = query.data?.pages.flatMap((p) => p.entries) ?? [];
  return (
    <AppFrame>
      <ScreenHeader
        title={c.balance}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/settings")
        }
      />
      <MotionEntrance
        style={{
          padding: 24,
          backgroundColor: theme.primary,
          borderRadius: 26,
          gap: 8,
          marginBottom: 24,
        }}
      >
        <AppText variant="title" color={String(theme.onPrimary)}>
          ${((wallet.data?.wallet.availableCents ?? balance) / 100).toFixed(2)}
        </AppText>
        <AppText color={String(theme.onPrimary)}>
          {c.coins}: {coins.toLocaleString(language)}
        </AppText>
      </MotionEntrance>
      <AppText variant="heading">{c.history}</AppText>
      {!token ? (
        <AppButton onPress={() => router.push("/login")}>{c.login}</AppButton>
      ) : null}
      {query.isError ? (
        <AppButton onPress={() => void query.refetch()}>{c.retry}</AppButton>
      ) : null}
      {!query.isPending && !entries.length && !query.isError ? (
        <AppText muted>{c.empty}</AppText>
      ) : null}
      {entries.map((e) => (
        <MotionEntrance
          key={e.id}
          style={{
            paddingVertical: 17,
            borderBottomWidth: 1,
            borderColor: theme.border,
            gap: 5,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="label">
                {c[e.type as keyof typeof c] ??
                  (e.amountCents < 0 ? c.out : c.in)}
              </AppText>
              <AppText muted variant="caption">
                {new Date(e.createdAt).toLocaleString(language)}
              </AppText>
            </View>
            <AppText
              variant="heading"
              color={String(e.amountCents < 0 ? theme.danger : theme.primary)}
            >
              {e.amountCents < 0 ? "−" : "+"}$
              {(Math.abs(e.amountCents) / 100).toFixed(2)}
            </AppText>
          </View>
          <AppText muted variant="caption">
            {c.after}: ${(e.balanceAfterCents / 100).toFixed(2)}
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
