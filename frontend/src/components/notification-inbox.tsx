import { useUiCopy } from "@/components/localized-native";

import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, AppState, FlatList, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View, type ViewToken } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { AppText } from "@/components/app-text";
import { PushNotificationsControl } from "@/components/push-notifications-control";
import { IconButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { inboxApi, type InboxNotification } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import { useCalendars } from "expo-localization";
import { useTranslation } from "@/hooks/use-translation";
import { formatNotificationTime } from "@/lib/notification-time";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dismissInboxNotifications } from "@/lib/notifications";

const config = { itemVisiblePercentThreshold: 70, minimumViewTime: 800 };
const copy = {
  ru: { system: "Системные", messages: "Сообщения", empty: "Сообщений пока нет", readAll: "Прочитать все", busy: "Читаем…", retry: "Не удалось отметить уведомления. Нажмите, чтобы повторить." },
  en: { system: "System", messages: "Messages", empty: "No messages yet", readAll: "Read all", busy: "Marking…", retry: "Could not mark notifications. Tap to retry." },
  uz: { system: "Tizim", messages: "Xabarlar", empty: "Hozircha xabarlar yo‘q", readAll: "Barchasini o‘qish", busy: "Belgilanmoqda…", retry: "Bildirishnomalar belgilanmadi. Qayta urining." },
};

export function NotificationInbox({ onClose, anchor }: { onClose: () => void; anchor?: { x: number; y: number; width: number; height: number } }) {
  const { copyText, copyContent } = useUiCopy();
  const closeAction = useRef(onClose);
  useEffect(() => { closeAction.current = onClose; }, [onClose]);
  const token = useAppStore(s => s.accessToken);
  const client = useQueryClient();
  const theme = useAppTheme();
  const { language } = useTranslation();
  const [calendar] = useCalendars();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") setNow(new Date()); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => setClosing(true), []);
  const reduced = useReducedMotion();
  const [readError, setReadError] = useState(false);
  const [filterWidth, setFilterWidth] = useState(0);
  const [selection] = useState(() => new Animated.Value(0));
  const [section, setSection] = useState<"system" | "messages">("system");
  const list = useRef<FlatList<InboxNotification>>(null);
  const viewport = useRef<View>(null);
  const rows = useRef(new Map<string, View>());
  const ready = useRef(false);
  const sectionRef = useRef(section);
  useEffect(() => { sectionRef.current = section; }, [section]);
  useEffect(() => {
    Animated.timing(selection, { toValue: section === "system" ? 0 : 1, duration: reduced ? 0 : 180, useNativeDriver: Platform.OS !== "web" }).start();
  }, [section, selection, reduced]);
  const closingRef = useRef(closing);
  useEffect(() => { closingRef.current = closing; }, [closing]);
  const c = copy[language];
  const seen = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const scrolled = useRef(false);
  const [offset] = useState(() => new Animated.Value(-height));
  const query = useInfiniteQuery({
    queryKey: ["inbox", token, true],
    initialPageParam: null as { date: string; id: string } | null,
    queryFn: ({ pageParam }) => inboxApi.list(token!, true, pageParam),
    getNextPageParam: page => page.next ?? undefined,
    enabled: Boolean(token),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    gcTime: 300_000,
    refetchOnMount: "always",
  });
  useEffect(() => {
    const animation = Animated.timing(offset, { toValue: closing ? -height : 0, duration: reduced ? 0 : 320, useNativeDriver: Platform.OS !== "web" });
    animation.start(({ finished }) => { if (finished && closing) closeAction.current(); });
    return () => animation.stop();
  }, [offset, reduced, closing, height]);
  const read = useCallback((ids: string[]) => {
    if (!token || !ids.length) return;
    ids = [...new Set(ids)].filter(id => !seen.current.has(id) || failed.current.has(id));
    if (!ids.length) return;
    ids.forEach(id => seen.current.add(id));
    void inboxApi.read(token, ids).then(() => {
      void client.invalidateQueries({ queryKey: ["unread-count", token] });
      void dismissInboxNotifications(ids).catch(() => {});
      client.setQueriesData<InfiniteData<Awaited<ReturnType<typeof inboxApi.list>>>>(
        { queryKey: ["inbox", token] },
        cached => cached ? { ...cached, pages: cached.pages.map(page => ({ ...page, items: page.items.map(item => ids.includes(item.id) ? { ...item, read: true } : item) })) } : cached,
      );
      ids.forEach(id => failed.current.delete(id));
      setReadError(failed.current.size > 0);
    }).catch(() => { ids.forEach(id => failed.current.add(id)); setReadError(true); });
  }, [token, client]);
  const viewable = useCallback(({ viewableItems }: { viewableItems: ViewToken<InboxNotification>[] }) => {
    if (!ready.current || closingRef.current || sectionRef.current !== "system" || (AppState.currentState && AppState.currentState !== "active") || (Platform.OS === "web" && document.visibilityState === "hidden")) return;
    read(viewableItems.filter(v => v.isViewable && !v.item.read && !seen.current.has(v.item.id)).map(v => v.item.id));
  }, [read]);
  const items = query.data?.pages.flatMap(page => page.items) ?? [];
  const checkVisible = useCallback(() => {
    if (!ready.current || closingRef.current || sectionRef.current !== "system" || (AppState.currentState && AppState.currentState !== "active") || (Platform.OS === "web" && document.visibilityState === "hidden")) return;
    viewport.current?.measureInWindow((_x, top, _w, height) => {
      if (!height) return;
      const visible: string[] = [];
      const checks = [...rows.current].map(([id, row]) => new Promise<void>(resolve => row.measureInWindow((_rx, y, _rw, h) => {
        if (h > 0 && Math.min(y + h, top + height) - Math.max(y, top) >= Math.min(h, height) * 0.7 && !seen.current.has(id)) visible.push(id);
        resolve();
      })));
      void Promise.all(checks).then(() => { if (ready.current && !closingRef.current && sectionRef.current === "system") read(visible); });
    });
  }, [read]);
  useEffect(() => {
    ready.current = false;
    const timer = setTimeout(() => { ready.current = !closing; if (!closing) { list.current?.recordInteraction(); checkVisible(); } }, reduced ? 100 : 500);
    return () => clearTimeout(timer);
  }, [closing, reduced, section, items.length, checkVisible]);
  // The bell anchor and the translucent modal use the same window coordinates.
  const anchorTop = anchor ? anchor.y : Math.max(insets.top, 12);
  return <Modal transparent visible hardwareAccelerated={Platform.OS === "android"} animationType="none" onRequestClose={close} statusBarTranslucent>
    <View style={[styles.overlay, { paddingTop: anchorTop + (anchor?.height ?? 48) + 12 }]}>
      <Pressable accessibilityLabel={copyText("Закрыть уведомления")} accessibilityRole="button" onPress={close} style={StyleSheet.absoluteFill} />
      {token ? <View style={[styles.readAllPosition, { top: anchorTop, right: Math.max(16, width - (anchor?.x ?? width - 68) + 8), minHeight: Math.max(anchor?.height ?? 48, 48) }]}>
        <View onLayout={e => setFilterWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist" style={[styles.readAllButton, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: "row", gap: 4, padding: 4, width: "100%", minHeight: 46 }]}>
          {filterWidth > 0 ? <Animated.View pointerEvents="none" style={{ position: "absolute", top: 4, bottom: 4, left: 4, width: (filterWidth - 12) / 2, borderRadius: 20, backgroundColor: theme.primarySoft, transform: [{ translateX: selection.interpolate({ inputRange: [0, 1], outputRange: [0, (filterWidth - 4) / 2] }) }] }} /> : null}
          {(["system", "messages"] as const).map(key => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: section === key }} onPress={() => setSection(key)} style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 36, paddingHorizontal: 6, paddingVertical: 7, borderRadius: 20 }}><AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} variant="caption" style={{ fontWeight: "700", lineHeight: 20, includeFontPadding: false, textAlignVertical: "center" }}>{copyContent(c[key])}</AppText></Pressable>)}
        </View>
      </View> : null}
      <View style={[styles.close, anchor ? { position: "absolute", left: anchor.x, top: anchorTop, width: anchor.width, height: anchor.height } : { position: "absolute", right: 20, top: anchorTop }]}>
        <IconButton name="close" label="Закрыть" onPress={close} />
      </View>
      <Animated.View accessibilityViewIsModal style={[styles.panel, { transform: [{ translateY: offset }] }]}>
        {!token ? <GlassSurface style={styles.card}><AppText>{copyText("Войдите, чтобы увидеть уведомления")}</AppText></GlassSurface> : null}
        {token && query.isPending ? <ActivityIndicator color={String(theme.primary)} /> : null}
        {query.error ? <Pressable onPress={() => void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())}><AppText color={String(theme.danger)}>{copyText("Не удалось загрузить. Нажмите, чтобы повторить.")}</AppText></Pressable> : null}
        {readError ? <Pressable onPress={() => read([...failed.current])}><AppText color={String(theme.danger)}>{copyText("Не удалось сохранить просмотр. Повторить")}</AppText></Pressable> : null}
        <View ref={viewport} collapsable={false} style={styles.listViewport}>
        <FlatList ref={list} data={section === "system" ? items : []} keyExtractor={item => item.id} style={{ flex: 1 }} contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 12) }]}
          initialNumToRender={4} maxToRenderPerBatch={2} windowSize={3} removeClippedSubviews={Platform.OS === "android"}
          onScroll={checkVisible} scrollEventThrottle={120} onLayout={checkVisible}
          onScrollBeginDrag={() => { scrolled.current = true; }}
          onEndReachedThreshold={0.15}
          onEndReached={() => {
            if (scrolled.current && query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) void query.fetchNextPage();
          }}
          onViewableItemsChanged={viewable} viewabilityConfig={config}
          renderItem={({ item }) => <View collapsable={false} ref={row => { if (row && !item.read) rows.current.set(item.id, row); else rows.current.delete(item.id); }} onLayout={checkVisible}><GlassSurface style={styles.card} variant="strong">
            <View style={styles.cardHeading}>
              <AppText variant="label" style={styles.cardTitle}>{copyContent(item.kind === "gift" ? "🎁 " : item.kind === "result" ? "🏆 " : "")}{item.title}</AppText>
              <AppText variant="caption" muted style={styles.timestamp}>{copyContent(formatNotificationTime(item.createdAt, { now, language, uses24hourClock: calendar.uses24hourClock }))}</AppText>
            </View>
            <AppText>{item.body}</AppText>
          </GlassSurface></View>}
          ListHeaderComponent={section === "system" ? <PushNotificationsControl /> : null}
          ListEmptyComponent={token && query.isSuccess ? <GlassSurface style={styles.card}><AppText>{copyContent(section === "messages" ? c.empty : language === "ru" ? "Уведомлений пока нет" : language === "uz" ? "Bildirishnomalar yo‘q" : "No notifications yet")}</AppText></GlassSurface> : null}
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={String(theme.primary)} /> : null}
        />
        </View>
      </Animated.View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", backgroundColor: "rgba(16,37,27,0.5)", paddingHorizontal: 18 },
  panel: { flex: 1, minHeight: 0, width: "100%", maxWidth: 560, gap: 12 },
  close: { alignSelf: "flex-end", zIndex: 10, elevation: 10 },
  readAllPosition: { position: "absolute", left: 16, alignItems: "flex-end", justifyContent: "center", zIndex: 10, elevation: 10 },
  readAllButton: { minHeight: 46, maxWidth: "100%", paddingHorizontal: 4, paddingVertical: 4, borderRadius: 24, borderWidth: 1 },
  listViewport: { flex: 1, minHeight: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  list: { gap: 12, paddingBottom: 8 },
  card: { padding: 18, borderRadius: 24, gap: 8 },
  cardHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 8 },
  cardTitle: { flexGrow: 1, flexShrink: 1, flexBasis: 150 },
  timestamp: { marginLeft: "auto", textAlign: "right", fontSize: 11, flexShrink: 1 },
});
