import { useInfiniteQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { AppText } from "@/components/app-text";
import { useTranslation } from "@/hooks/use-translation";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { leaderboardApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import type { LeaderboardMetric } from "@/types";

export function RankingPreview({ metric, onPress }: { metric: LeaderboardMetric; onPress: () => void }) {
  const token = useAppStore(s => s.accessToken);
  const theme = useAppTheme();
  const { language } = useTranslation();
  const query = useInfiniteQuery({
    queryKey: ["leaderboard", token],
    queryFn: ({ pageParam, signal }) => leaderboardApi.getPage(pageParam, 10, token!, signal),
    enabled: !!token,
    initialPageParam: 0,
    getNextPageParam: page => page.offset + page.limit < page.total ? page.offset + page.limit : undefined,
    staleTime: 60_000,
    refetchOnMount: false,
  });
  const leaders = (query.data?.pages[0]?.leaderboards[metric].entries ?? []).slice(0, 3);
  return <Pressable accessibilityRole="button" accessibilityLabel={metric === "wealth" ? "Рейтинг" : metric === "wallet" ? "Рейтинг по деньгам" : "Рейтинг по коинам"} onPress={onPress}>
    <GlassSurface intensity={66} variant="strong" style={{ minHeight: 48, borderRadius: 24, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ alignItems: "center", gap: 3, paddingVertical: 5 }}>
        <AppText style={{ fontSize: 11, fontWeight: "700" }}>{language === "uz" ? "Reyting" : language === "ru" ? "Рейтинг" : "Ranking"}</AppText>
        {leaders.length ? <View style={{ flexDirection: "row" }}>{leaders.map((entry, index) => <View key={entry.userId} style={{ marginLeft: index ? -8 : 0, zIndex: 3 - index }} accessible accessibilityLabel={`${entry.rank} место: ${entry.name}`}><Avatar name={entry.name} avatarUrl={entry.avatarUrl} size={24} /></View>)}</View> : null}
      </View>
      <Ionicons name={metric === "wealth" ? "trophy" : metric === "wallet" ? "wallet-outline" : "diamond-outline"} size={17} color={metric === "wealth" ? "#F5B800" : String(theme.primary)} />
    </GlassSurface>
  </Pressable>;
}
