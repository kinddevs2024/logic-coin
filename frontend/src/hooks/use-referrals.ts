import { useInfiniteQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import { referralsApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export function useReferrals() {
  const focused = useIsFocused();
  const accessToken = useAppStore(state => state.accessToken);
  const authMode = useAppStore(state => state.authMode);
  const enabled = focused && authMode === "authenticated" && Boolean(accessToken);
  const query = useInfiniteQuery({
    queryKey: ["referrals", accessToken, "pages"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => referralsApi.overview(accessToken!, pageParam),
    getNextPageParam: page => page.nextOffset ?? undefined,
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });
  const { refetch } = query;
  useEffect(() => {
    if (!enabled) return;
    // Android foreground changes are not browser window-focus events.
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") void refetch();
    });
    return () => subscription.remove();
  }, [enabled, refetch]);
  return { ...query, data: query.data ? { ...query.data.pages[0], friends: [...new Map(query.data.pages.flatMap(page => page.friends).map(friend => [friend.id, friend])).values()] } : undefined };
}
