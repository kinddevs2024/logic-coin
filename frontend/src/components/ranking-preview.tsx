import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { leaderboardApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import type { LeaderboardMetric } from "@/types";

export function RankingPreview({ metric, onPress }: { metric: LeaderboardMetric; onPress: () => void }) {
  const token = useAppStore(s => s.accessToken);
  const theme = useAppTheme();
  const query = useQuery({ queryKey: ["leaderboard", metric, token], queryFn: () => leaderboardApi.get(metric, token!), enabled: !!token, staleTime: 30_000 });
  const leaders = [...(query.data?.entries ?? [])].sort((a, b) => a.rank - b.rank).slice(0, 3);
  return <Pressable accessibilityRole="button" accessibilityLabel={metric === "wallet" ? "Рейтинг по деньгам" : "Рейтинг по коинам"} onPress={onPress}>
    <GlassSurface intensity={66} variant="strong" style={{ minHeight: 48, borderRadius: 24, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
      {leaders.length ? <View style={{ flexDirection: "row" }}>{leaders.map((entry, index) => <View key={entry.userId} style={{ marginLeft: index ? -8 : 0, zIndex: 3 - index }} accessible accessibilityLabel={`${entry.rank} место: ${entry.name}`}><Avatar name={entry.name} avatarUrl={entry.avatarUrl} size={24} /></View>)}</View> : null}
      <Ionicons name={metric === "wallet" ? "wallet-outline" : "diamond-outline"} size={17} color={String(theme.primary)} />
    </GlassSurface>
  </Pressable>;
}
