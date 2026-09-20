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
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => setClosing(true), []);
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
    const animation = Animated.timing(offset, { toValue: closing ? -height : 0, duration: reduced ? 0 : 320, useNativeDriver: Platform.OS !== "web" });
    animation.start(({ finished }) => { if (finished && closing) onClose(); });
    return () => animation.stop();
  }, [offset, reduced, closing, height, onClose]);
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
  return <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
    <View style={[styles.overlay, { paddingTop: Math.max(insets.top, 12) }]}>
      <Pressable accessibilityLabel="Закрыть уведомления" accessibilityRole="button" onPress={close} style={StyleSheet.absoluteFill} />
      <Animated.View accessibilityViewIsModal style={[styles.panel, { transform: [{ translateY: offset }] }]}>
        <View style={styles.close}>
          <IconButton name="close" label="Закрыть" onPress={close} />
        </View>
        {!token ? <GlassSurface style={styles.card}><AppText>Войдите, чтобы увидеть уведомления</AppText></GlassSurface> : null}
        {token && query.isPending ? <ActivityIndicator color={String(theme.primary)} /> : null}
        {query.error ? <Pressable onPress={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())}><AppText color={String(theme.danger)}>Не удалось загрузить. Нажмите, чтобы повторить.</AppText></Pressable> : null}
        {readError ? <Pressable onPress={() => read([...failed.current])}><AppText color={String(theme.danger)}>Не удалось сохранить просмотр. Повторить</AppText></Pressable> : null}
        <View style={styles.listViewport}>
        <FlatList data={items} keyExtractor={item => item.id} style={{ flex: 1 }} contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 12) }]}
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
        </View>
      </Animated.View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", backgroundColor: "rgba(4,12,26,0.5)", paddingHorizontal: 18 },
  panel: { flex: 1, minHeight: 0, width: "100%", maxWidth: 560, gap: 12 },
  close: { alignSelf: "flex-end" },
  listViewport: { flex: 1, minHeight: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  list: { gap: 12, paddingBottom: 8 },
  card: { padding: 18, borderRadius: 24, gap: 8 },
  cardHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 8 },
  cardTitle: { flexGrow: 1, flexShrink: 1, flexBasis: 150 },
  timestamp: { marginLeft: "auto", textAlign: "right", fontSize: 11, flexShrink: 1 },
});
