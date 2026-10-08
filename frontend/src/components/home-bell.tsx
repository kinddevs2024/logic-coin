import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppText } from "./app-text";
import { IconButton } from "./buttons";
import { inboxApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export function HomeBell({ onPress }: { onPress: () => void }) {
  const token = useAppStore(state => state.accessToken);
  const focused = useIsFocused();
  const query = useQuery({
    queryKey: ["unread-count", token],
    queryFn: () => inboxApi.unreadCount(token!),
    enabled: Boolean(token) && focused,
    staleTime: 15_000,
    refetchInterval: focused ? 60_000 : false,
  });
  const count = query.data?.count ?? 0;
  return <View>
    <IconButton name="notifications-outline" label={count ? `Уведомления: ${count} непрочитанных` : "Уведомления"} onPress={onPress} />
    {count > 0 ? <View pointerEvents="none" style={styles.badge}><AppText style={styles.number}>{count > 99 ? "99+" : count}</AppText></View> : null}
  </View>;
}
const styles = StyleSheet.create({
  badge: { position: "absolute", top: -3, right: -3, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#DC3545" },
  number: { color: "#FFFFFF", fontSize: 10, lineHeight: 14, fontWeight: "800" },
});
