import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
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
type Attempt = {
  id: string;
  gameKey: string;
  title: Record<string, string> | null;
  mode: string;
  score: number;
  coins: number;
  completedAt: string;
};
export default function ActivityScreen() {
  const c = useAccountCopy(),
    theme = useAppTheme(),
    router = useRouter(),
    params = useLocalSearchParams<{ mode?: string; period?: string }>();
  const mode = params.mode === "challenge" ? "challenge" : "all",
    period = params.period === "today" ? "today" : "all",
    token = useAppStore((s) => s.accessToken),
    language = useAppStore((s) => s.language) ?? "uz";
  const query = useInfiniteQuery({
    queryKey: ["account-activity", token, mode, period],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      authenticatedRequest<{ items: Attempt[]; nextCursor: string | null }>(
        `/me/activity?mode=${mode}&period=${period}${pageParam ? `&cursor=${pageParam}` : ""}`,
        { token: token! },
      ),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: Boolean(token),
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <AppFrame>
      <ScreenHeader
        title={mode === "challenge" ? c.challenges : c.games}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/settings")
        }
      />
      {query.isError ? (
        <AppButton onPress={() => void query.refetch()}>{c.retry}</AppButton>
      ) : null}
      {!query.isPending && !items.length ? (
        <AppText muted>{c.empty}</AppText>
      ) : null}
      {items.map((a) => (
        <MotionEntrance
          key={a.id}
          style={{
            padding: 18,
            borderRadius: 22,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            marginBottom: 12,
            gap: 6,
          }}
        >
          <AppText variant="heading">
            {a.title?.[language] ?? a.title?.uz ?? a.gameKey.replace(/-/g, " ")}
          </AppText>
          <AppText muted>
            {new Date(a.completedAt).toLocaleString(language)}
          </AppText>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <AppText>
              {c.score}: {a.score}
            </AppText>
            <AppText color={String(theme.primary)}>
              +{a.coins} {c.coins}
            </AppText>
          </View>
        </MotionEntrance>
      ))}
      {query.hasNextPage ? (
        <AppButton
          onPress={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          {c.more}
        </AppButton>
      ) : null}
    </AppFrame>
  );
}
