import { useEffect, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "./app-text";
import { inboxApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { useAppTheme } from "@/hooks/use-app-theme";

export function HomeBell({ onPress }: { onPress: () => void }) {
  const token = useAppStore(s => s.accessToken);
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const theme = useAppTheme();
  const [angle] = useState(() => new Animated.Value(0));
  const query = useQuery({ queryKey: ["unread-count", token], queryFn: () => inboxApi.unreadCount(token!), enabled: Boolean(token) && focused, refetchInterval: focused ? 60000 : false, staleTime: 15000 });
  const count = query.data?.count ?? 0;
  useEffect(() => {
    if (!focused || reduced || count === 0) return;
    const motion = Animated.sequence([1, -1, 0.7, -0.7, 0].map(value => Animated.timing(angle, { toValue: value, duration: 110, useNativeDriver: true })));
    motion.start();
    return () => { motion.stop(); angle.setValue(0); };
  }, [count, focused, reduced, angle]);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Уведомления${count ? `: ${count}` : ""}`} onPress={onPress} style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: theme.surfaceRaised }}>
    <Animated.View style={{ transform: [{ rotate: angle.interpolate({ inputRange: [-1, 1], outputRange: ["-18deg", "18deg"] }) }] }}><Ionicons name="notifications-outline" size={25} color={theme.text} /></Animated.View>
    {count > 0 ? <View style={{ position: "absolute", right: -3, top: -3, borderRadius: 12, minWidth: 20, padding: 3, backgroundColor: "#DC3545", alignItems: "center" }}><AppText style={{ color: "#FFFFFF", fontSize: 10 }}>{count > 99 ? "99+" : count}</AppText></View> : null}
  </Pressable>;
}
