import { useUiCopy } from "@/components/localized-native";

import { useInfiniteQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { leaderboardApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import type { LeaderboardMetric } from "@/types";

export function RankingPreview({ metric, onPress }: { metric: LeaderboardMetric; onPress: () => void }) {
  const { copyText, formatCopy } = useUiCopy();
  const token = useAppStore(s => s.accessToken);
  const theme = useAppTheme();
  const query = useInfiniteQuery({
    queryKey: ["leaderboard", token, 15, "periods"],
    queryFn: ({ pageParam, signal }) => leaderboardApi.getPage(pageParam, 15, token!, signal),
    enabled: !!token,
    initialPageParam: 0,
    getNextPageParam: page => page.offset + page.limit < page.total ? page.offset + page.limit : undefined,
    staleTime: 60_000,
    refetchOnMount: false,
  });
  const leaders = (query.data?.pages[0]?.leaderboards[metric].entries ?? []).slice(0, 3);
  return <Pressable accessibilityRole="button" accessibilityLabel={copyText("Рейтинг")} onPress={onPress}>
    <GlassSurface intensity={66} variant="strong" style={{ minHeight: 48, borderRadius: 24, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
      {leaders.length ? <View style={{ flexDirection: "row" }}>{leaders.map((entry, index) => <View key={entry.userId} style={{ marginLeft: index ? -8 : 0, zIndex: 3 - index }} accessible accessibilityLabel={formatCopy("{0} место: {1}", [entry.rank, entry.name])}><Avatar name={entry.name} avatarUrl={entry.avatarUrl} size={24} /></View>)}</View> : null}
      <Ionicons name={"trophy"} size={17} color={"#F5B800"} />
    </GlassSurface>
  </Pressable>;
}
