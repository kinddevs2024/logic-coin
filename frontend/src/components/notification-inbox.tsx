import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, FlatList, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View, type ViewToken } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { AppText } from "@/components/app-text";
import { IconButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { inboxApi, type InboxNotification } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { useCalendars } from "expo-localization";
import { useTranslation } from "@/hooks/use-translation";
import { formatNotificationTime } from "@/lib/notification-time";

const config = { itemVisiblePercentThreshold: 70, minimumViewTime: 800 };

export function NotificationInbox({ onClose }: { onClose: () => void }) {
  const token = useAppStore(s => s.accessToken);
  const theme = useAppTheme();
  const { language } = useTranslation();
  const [calendar] = useCalendars();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") setNow(new Date()); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [readError, setReadError] = useState(false);
  const seen = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const [offset] = useState(() => new Animated.Value(-height));
  const query = useInfiniteQuery({
    queryKey: ["inbox", token, true],
    initialPageParam: null as { date: string; id: string } | null,
    queryFn: ({ pageParam }) => inboxApi.list(token!, true, pageParam),
    getNextPageParam: page => page.next ?? undefined,
    enabled: Boolean(token),
    refetchOnWindowFocus: false,
    gcTime: 0,
  });
  useEffect(() => {
    const animation = Animated.timing(offset, { toValue: 0, duration: reduced ? 0 : 320, useNativeDriver: Platform.OS !== "web" });
    animation.start();
    return () => animation.stop();
  }, [offset, reduced]);
  const read = useCallback((ids: string[]) => {
    if (!token || !ids.length) return;
    ids.forEach(id => seen.current.add(id));
    void inboxApi.read(token, ids).then(() => {
      ids.forEach(id => failed.current.delete(id));
      setReadError(failed.current.size > 0);
    }).catch(() => { ids.forEach(id => failed.current.add(id)); setReadError(true); });
  }, [token]);
  const viewable = useCallback(({ viewableItems }: { viewableItems: ViewToken<InboxNotification>[] }) => {
    if (AppState.currentState !== "active" || (Platform.OS === "web" && document.visibilityState === "hidden")) return;
    read(viewableItems.filter(v => v.isViewable && !v.item.read && !seen.current.has(v.item.id)).map(v => v.item.id));
  }, [read]);
  const items = query.data?.pages.flatMap(page => page.items) ?? [];
  return <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.overlay}>
      <Pressable accessibilityLabel="Закрыть уведомления" accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill} />
      <Animated.View accessibilityViewIsModal style={[styles.panel, { maxHeight: height * 0.76, transform: [{ translateY: offset }] }]}>
        <View style={styles.close}>
          <IconButton name="close" label="Закрыть" onPress={onClose} />
        </View>
        {!token ? <GlassSurface style={styles.card}><AppText>Войдите, чтобы увидеть уведомления</AppText></GlassSurface> : null}
        {token && query.isPending ? <ActivityIndicator color={String(theme.primary)} /> : null}
        {query.error ? <Pressable onPress={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())}><AppText color={String(theme.danger)}>Не удалось загрузить. Нажмите, чтобы повторить.</AppText></Pressable> : null}
        {readError ? <Pressable onPress={() => read([...failed.current])}><AppText color={String(theme.danger)}>Не удалось сохранить просмотр. Повторить</AppText></Pressable> : null}
        <FlatList data={items} keyExtractor={item => item.id} style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={styles.list}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) void query.fetchNextPage();
          }}
          onViewableItemsChanged={viewable} viewabilityConfig={config}
          renderItem={({ item }) => <GlassSurface style={styles.card} variant="strong">
            <View style={styles.cardHeading}>
              <AppText variant="label" style={styles.cardTitle}>{item.kind === "gift" ? "🎁 " : item.kind === "result" ? "🏆 " : ""}{item.title}</AppText>
              <AppText variant="caption" muted style={styles.timestamp}>{formatNotificationTime(item.createdAt, { now, language, uses24hourClock: calendar.uses24hourClock })}</AppText>
            </View>
            <AppText>{item.body}</AppText>
          </GlassSurface>}
          ListEmptyComponent={token && query.isSuccess ? <GlassSurface style={styles.card}><AppText>Уведомлений пока нет</AppText></GlassSurface> : null}
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={String(theme.primary)} /> : null}
        />
      </Animated.View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(4,12,26,0.5)", padding: 18 },
  panel: { width: "100%", maxWidth: 560, gap: 12 },
  close: { alignSelf: "flex-end" },
  list: { gap: 12, paddingBottom: 8 },
  card: { padding: 18, borderRadius: 24, gap: 8 },
  cardHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 8 },
  cardTitle: { flexGrow: 1, flexShrink: 1, flexBasis: 150 },
  timestamp: { marginLeft: "auto", textAlign: "right", fontSize: 11, flexShrink: 1 },
});
