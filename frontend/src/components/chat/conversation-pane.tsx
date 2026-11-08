import { FeedAd } from "@/components/feed-ad";
import { catchUpChatHead } from "@/lib/chat-sync";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { useVisibleChatSeq } from "./use-visible-chat-seq";
import { MotionEntrance } from "@/components/motion-entrance";
import { OfficialBadge } from "./official-badge";
import {
  watchChatConversation,
  subscribeToChallengeUpdates,
  sendChatTyping,
} from "@/lib/challenge-live-updates";
import { dismissInboxNotifications } from "@/lib/notifications";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { ChatThemeProvider } from "./chat-theme";
import { ChatThemePreview } from "./chat-theme-preview";
import { ChatPopover, type ChatAnchor } from "./chat-popover";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import {
  Animated,
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
  type ViewToken,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "@/components/app-text";
import { LogoMark } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  chatApi,
  chatMediaUrl,
  type ChatRoom,
  type ChatItem,
  type ChatDraftFile,
  type ChatFile,
} from "@/lib/chat-api";
import { useChatCopy } from "@/lib/chat-copy";
import { useChatOutbox } from "@/lib/chat-outbox";
import { pickChatPhoto, pickChatFile, shareChatFile } from "@/lib/chat-media";
import { ChatAction, ChatSheet } from "./chat-sheet";
import { ChatBubble } from "./chat-bubble";
import { VoiceRecorder } from "./voice-recorder";

const ChatWallpaper = memo(function ChatWallpaper({ uri }: { uri: string }) {
  const source = useMemo(() => ({ uri }), [uri]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Image source={source} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: 0.3 }]} />
  </View>;
});

export function ConversationPane(props: ComponentProps<typeof ConversationPaneContent>) {
  return <ChatThemeProvider appearance={props.room.chatTheme}><ConversationPaneContent {...props} /></ChatThemeProvider>;
}
function ConversationPaneContent({
  room,
  token,
  accountId,
  chats,
  onBack,
  onProfile,
  onInfo,
  initialSearch = "",
}: {
  initialSearch?: string;
  room: ChatRoom;
  token: string;
  accountId: string;
  chats: ChatRoom[];
  onBack: () => void;
  onProfile: (id: string) => void;
  onInfo: () => void;
}) {
  const composerRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const peer = useQuery({queryKey:["chat-profile",token,room.peer?.id],enabled:room.kind === "direct" && Boolean(room.peer?.id),queryFn:()=>chatApi.profile(token,room.peer!.id),refetchInterval:15_000});
  const needsFriend = room.kind === "direct" && peer.data?.friendship !== "friends";
  const [inputHeight, setInputHeight] = useState(44);
  const [chatMenu, setChatMenu] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const [actionAnchor, setActionAnchor] = useState<ChatAnchor>({x: 180, y: 180});
  const [deleting, setDeleting] = useState<ChatItem | null>(null);
  const [draftPhoto, setDraftPhoto] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState(68);
  const reducedMotion = useReducedMotion();
  const [searchAnimation] = useState(
    () => new Animated.Value(initialSearch ? 1 : 0),
  );
  const [voiceActive, setVoiceActive] = useState(false);
  const [typingUntil, setTypingUntil] = useState(0);
  const typingSent = useRef(0);
  useEffect(() => {
    const unwatch = watchChatConversation(token, room.id);
    const unsubscribe = subscribeToChallengeUpdates(token, (state) => {
      if (state.chatTyping?.conversationId === room.id)
        setTypingUntil(state.chatTyping.expiresAt);
    });
    return () => {
      unwatch();
      unsubscribe();
    };
  }, [token, room.id]);
  useEffect(() => {
    if (!typingUntil) return;
    const timer = setTimeout(
      () => setTypingUntil(0),
      Math.max(0, typingUntil - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [typingUntil]);
  const theme = useAppTheme(),
    c = useChatCopy(),
    client = useQueryClient();
  const [text, setText] = useState(""),
    [searchDraft, setSearchDraft] = useState(initialSearch),
    [search, setSearch] = useState(initialSearch),
    [showSearch, setShowSearch] = useState(Boolean(initialSearch)),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const animation = Animated.timing(searchAnimation, {
      toValue: showSearch ? 1 : 0,
      duration: reducedMotion ? 0 : 220,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [showSearch, searchAnimation, reducedMotion]);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchDraft.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchDraft]);
  const [reply, setReply] = useState<ChatItem | null>(null),
    [editing, setEditing] = useState<ChatItem | null>(null),
    [action, setAction] = useState<ChatItem | null>(null);
  useEffect(() => {
    if (!reply) return;
    const timer = setTimeout(() => composerRef.current?.focus(), Platform.OS === "web" ? 0 : 250);
    return () => clearTimeout(timer);
  }, [reply]);
  const [forward, setForward] = useState<{
      message: ChatItem;
      clientId: string;
    } | null>(null),
    [forwardSearch, setForwardSearch] = useState("");
  const [report, setReport] = useState<ChatItem | null>(null),
    [reason, setReason] = useState(""),
    [photo, setPhoto] = useState<ChatFile | null>(null);
  const [attachments, setAttachments] = useState<
      { id: string; name: string; previewUri?: string }[]
    >([]),
    [uploading, setUploading] = useState(false),
    [busy, setBusy] = useState(false),
    [attachMenu, setAttachMenu] = useState(false);
  const previewUrls = useRef(new Set<string>());
  useEffect(() => {
    const next = new Set(attachments.map(file => file.previewUri).filter((uri): uri is string => Boolean(uri?.startsWith("blob:"))));
    for (const uri of previewUrls.current) if (!next.has(uri)) URL.revokeObjectURL(uri);
    previewUrls.current = next;
  }, [attachments]);
  useEffect(() => () => { for (const uri of previewUrls.current) URL.revokeObjectURL(uri); }, []);
  const list = useRef<FlatList<ChatItem>>(null),
    autoScroll = useRef(true),
    readSeq = useRef(0);
  const query = useInfiniteQuery({
    queryKey: ["chat-messages", token, room.id, search],
    queryFn: ({ pageParam }) => {
      if (pageParam !== undefined || search) return chatApi.messages(token, room.id, pageParam, search || undefined);
      const cached = client.getQueryData<{ pages: { items: ChatItem[]; before: number | null }[] }>(["chat-messages", token, room.id, search]);
      return catchUpChatHead(before => chatApi.messages(token, room.id, before), cached?.pages[0]);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.before ?? undefined,
    refetchInterval: 5000,
    staleTime: 3000,
  });
  const [reactionOverrides, setReactionOverrides] = useState<Record<string, ChatItem["reactions"]>>({});
  const reacting = useRef(false);
  const items = useMemo(() => {
    const map = new Map<string, ChatItem>();
    for (const page of [...(query.data?.pages ?? [])].reverse())
      for (const item of page.items) map.set(item.id, item);
    return [...map.values()].map(item => reactionOverrides[item.id] ? { ...item, reactions: reactionOverrides[item.id] } : item).sort((a, b) => a.seq - b.seq);
  }, [query.data, reactionOverrides]);
  const displayItems = useMemo(() => [...items].reverse(), [items]);
  const pinnedMessages = query.data?.pages[0]?.pinned ?? items.filter(item => item.pinned && !item.deleted).slice().reverse();
  const [pinIndex, setPinIndex] = useState(0);
  const pinnedMessage = pinnedMessages[pinIndex % Math.max(1, pinnedMessages.length)];
  const [jumpToPin, setJumpToPin] = useState<string | null>(null);
  const { isFetching, hasNextPage, fetchNextPage } = query;
  const historyLaidOut = useRef(false);
  const olderHistoryRequested = useRef(false);
  useEffect(() => {
    if (!olderHistoryRequested.current || isFetching || !hasNextPage) return;
    olderHistoryRequested.current = false;
    void fetchNextPage({ cancelRefetch: false }).catch(() => {});
  }, [isFetching, hasNextPage, fetchNextPage]);
  useEffect(() => {
    if (!jumpToPin || isFetching) return;
    const index = displayItems.findIndex(item => item.id === jumpToPin);
    if (index >= 0 || !hasNextPage) {
      const frame = requestAnimationFrame(() => {
        if (index >= 0) {
          autoScroll.current = false;
          list.current?.scrollToIndex({ index, animated: !reducedMotion, viewPosition: 0.3 });
        }
        setJumpToPin(null);
      });
      return () => cancelAnimationFrame(frame);
    }
    void fetchNextPage();
  }, [jumpToPin, displayItems, isFetching, hasNextPage, fetchNextPage, reducedMotion]);
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: ["chat-list", token] }, { cancelRefetch: false });
    return client.invalidateQueries({
      queryKey: ["chat-messages", token, room.id],
    }, { cancelRefetch: false });
  }, [client, token, room.id]);
  const confirmSent = useCallback(async () => {
    // A running request may have started before send was acknowledged. Finish
    // it first, then fetch a post-ack snapshot before removing the local bubble.
    await refresh();
    await client.invalidateQueries({ queryKey: ["chat-messages", token, room.id] }, { cancelRefetch: false, throwOnError: true });
  }, [client, token, room.id, refresh]);
  const outbox = useChatOutbox(token, accountId, room.id, confirmSent);
  const forwardResults = useQuery({
    queryKey: ["chat-search", token, forwardSearch],
    enabled: Boolean(forward && forwardSearch.trim().length >= 2),
    queryFn: () => chatApi.search(token, forwardSearch),
    staleTime: 15_000,
  });
  const showError = (err: unknown) =>
    setError(err instanceof Error ? err.message : c.error);
  const run = async (operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await operation();
      setAction(null);
      refresh();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };
  const reactToMessage = async (item: ChatItem, emoji: string) => {
    if (reacting.current) return;
    reacting.current = true;
    setAction(null);
    setError(null);
    const next = item.reactions.some(r => r.userId === accountId && r.emoji === emoji) ? "" : emoji;
    const ownReaction = item.reactions.find(r => r.userId === accountId);
    const self = ownReaction?.user ?? items.find(message => message.sender.id === accountId)?.sender;
    setReactionOverrides(current => ({ ...current, [item.id]: [
      ...item.reactions.filter(r => r.userId !== accountId),
      ...(next ? [{ userId: accountId, emoji: next, ...(self ? { user: self } : {}) }] : []),
    ] }));
    try {
      await chatApi.change(token, item.id, { emoji: next });
      await query.refetch();
    } catch (err) {
      showError(err);
    } finally {
      setReactionOverrides(current => {
        const remaining = { ...current };
        delete remaining[item.id];
        return remaining;
      });
      reacting.current = false;
    }
  };
  const upload = async (file: ChatDraftFile) => {
    setUploading(true);
    setError(null);
    try {
      const a = await chatApi.upload(token, file);
      setAttachments((current) => [...current, { ...a, ...(file.kind === "photo" ? { previewUri: file.uri || (file.blob ? URL.createObjectURL(file.blob) : `data:${file.mime};base64,${file.base64}`) } : {}) }].slice(0, 4));
    } finally {
      setUploading(false);
    }
  };
  const pick = async (kind: "photo" | "file") => {
    setAttachMenu(false);
    try {
      const file = await (kind === "photo" ? pickChatPhoto() : pickChatFile());
      if (file) await upload(file);
    } catch (err) {
      showError(err);
    }
  };
  const send = async () => {
    if ((!text.trim() && !attachments.length) || uploading || busy) return;
    setError(null);
    setBusy(true);
    try {
      if (editing) {
        await chatApi.change(token, editing.id, { text: text.trim() });
        setEditing(null);
        refresh();
      } else
        await outbox.enqueue(
          text.trim(),
          attachments.map((a) => a.id),
          reply?.id,
        );
      setText("");
      setInputHeight(44);
      setAttachments([]);
      setReply(null);
      autoScroll.current = true;
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  };
  const forwardTo = async (id: string) => {
    if (!forward || busy) return;
    await run(async () => {
      await chatApi.send(token, id, {
        clientId: forward.clientId,
        forwardId: forward.message.id,
      });
      setForward(null);
    });
  };
  const share = async (item: ChatItem) => {
    if (item.attachments.length) {
      const file = item.attachments[0]!;
      await shareChatFile(chatMediaUrl(file.url), file.name, file.mime);
    } else await Share.share({ message: item.text });
  };
  const markRead = useCallback(
    (seq: number) => {
      if (search || (Platform.OS !== "web" && AppState.currentState !== "active")) return;
      if (seq <= readSeq.current) return;
      readSeq.current = seq;
      void chatApi
        .member(token, room.id, { readSeq: seq })
        .then(async (result) => {
          if (result.readIds?.length)
            await dismissInboxNotifications(result.readIds);
          await Promise.all([
            client.invalidateQueries({ queryKey: ["chat-list", token] }),
            client.invalidateQueries({ queryKey: ["inbox", token] }),
            client.invalidateQueries({ queryKey: ["unread-count", token] }),
          ]);
        })
        .catch(() => {
          readSeq.current = 0;
        });
    },
    [token, room.id, search, client],
  );
  useVisibleChatSeq(!search, markRead);
  const visible = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<ChatItem>[] }) => {
      if (Platform.OS === "web") return;
      markRead(Math.max(0, ...viewableItems.filter(v => v.isViewable).map(v => v.item.seq)));
    }, [markRead],
  );
  const visibleHandler = useRef(visible);
  useEffect(() => {
    visibleHandler.current = visible;
  }, [visible]);
  const [onVisible] = useState(
    () => (info: { viewableItems: ViewToken<ChatItem>[] }) =>
      visibleHandler.current(info),
  );
  const [visibilityConfig] = useState(() => ({
    itemVisiblePercentThreshold: 50,
  }));
  const inputStyle = [
    styles.input,
    {
      color: theme.text,
      backgroundColor: theme.surfaceRaised,
      borderColor: theme.border,
    },
  ];
  return (
    <MotionEntrance style={{ flex: 1, minHeight: 0 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        keyboardVerticalOffset={Platform.OS === "android" ? insets.top : 0}
        style={[styles.page, { backgroundColor: theme.background }]}
      >
        {room.chatTheme?.preset === "custom" && room.chatTheme.wallpaperUrl ? <ChatWallpaper uri={chatMediaUrl(room.chatTheme.wallpaperUrl)} /> : theme.wallpaperUrl ? <ChatWallpaper uri={theme.wallpaperUrl} /> : null}
        <View
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
          style={[
            styles.header,
            { borderBottomColor: theme.border, backgroundColor: theme.surface },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.cancel}
            onPress={onBack}
            style={styles.icon}
          >
            <Ionicons
              name="chevron-back"
              size={25}
              color={String(theme.primary)}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${c.settings}: ${room.title}`}
            onPress={onInfo}
            style={styles.person}
          >
            {room.isOfficial ?? Boolean(room.systemKey || (room.kind === "support" && room.isOwner !== true)) ? (
              <LogoMark size={43} />
            ) : (
              <Avatar
                name={room.title}
                avatarUrl={
                  room.peer?.avatarUrl ??
                  (room.avatarUrl ? chatMediaUrl(room.avatarUrl) : null)
                }
                size={42}
              />
            )}
            <View style={{ flex: 1 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <AppText
                  variant="heading"
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {room.systemKey === "news"
                    ? c.news
                    : room.systemKey === "community"
                      ? c.community
                      : room.kind === "support" && room.isOfficial
                        ? c.support
                        : room.title}
                </AppText>
                {room.isOfficial ?? Boolean(room.systemKey || (room.kind === "support" && room.isOwner !== true)) ? (
                  <OfficialBadge />
                ) : null}
              </View>
              <AppText variant="caption" muted>
                {room.kind === "channel"
                  ? c.channels
                  : room.kind === "group"
                    ? c.groups
                    : room.peer?.username
                      ? `@${room.peer.username}`
                      : c.direct}
              </AppText>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showSearch ? c.close : c.settings}
            onPress={() => {
              if (showSearch) {
                setShowSearch(false);
                setSearch("");
                setSearchDraft("");
              } else setChatMenu(true);
            }}
            style={[styles.icon, { marginRight: 12 }]}
          >
            <Ionicons
              name={showSearch ? "close" : "ellipsis-horizontal"}
              size={24}
              color={String(theme.primary)}
            />
          </Pressable>
        </View>
        {pinnedMessage ? <MotionEntrance style={{backgroundColor: theme.surface, borderBottomWidth: 1, borderColor: theme.border}}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${c.pinnedMessage}: ${pinnedMessage.text || c.attach}`} onPress={() => {
            autoScroll.current = false;
            setSearch(""); setSearchDraft(""); setShowSearch(false);
            setJumpToPin(pinnedMessage.id);
            setPinIndex(index => (index + 1) % pinnedMessages.length);
          }} style={{flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingVertical: 9}}>
            <View style={{width: 3, height: 34, borderRadius: 2, backgroundColor: theme.primary}} />
            <View style={{flex: 1, gap: 2}}>
              <AppText variant="caption" color={String(theme.primary)}>{c.pinnedMessage}{pinnedMessages.length > 1 ? ` · ${(pinIndex % pinnedMessages.length) + 1}/${pinnedMessages.length}` : ""}</AppText>
              <AppText numberOfLines={1}>{pinnedMessage.text || c.attach}</AppText>
            </View>
            <Ionicons name="pin-outline" size={21} color={String(theme.primary)} />
          </Pressable>
        </MotionEntrance> : null}
        {showSearch ? (
          <Animated.View
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              top: headerHeight + (pinnedMessage ? 60 : 0) + 8,
              zIndex: 5,
              opacity: searchAnimation,
              transform: [
                {
                  translateY: searchAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            }}
          >
            <TextInput
              accessibilityLabel={c.textSearch}
              autoFocus
              value={searchDraft}
              onChangeText={setSearchDraft}
              placeholder={c.searchShort}
              placeholderTextColor={theme.textMuted}
              style={[...inputStyle, { minHeight: 44, margin: 0 }]}
            />
          </Animated.View>
        ) : null}
        {query.isPending ? (
          <ActivityIndicator
            style={{ margin: 20 }}
            color={String(theme.primary)}
          />
        ) : null}
        {query.isError ? (
          <ChatAction
            title={c.retry}
            onPress={() => {
              void query.refetch();
            }}
            icon="refresh"
          />
        ) : null}
        <FlatList
          ref={list}
          inverted
          data={displayItems}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.history,
            { paddingTop: 14, paddingBottom: showSearch ? 72 : 14 },
          ]}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          windowSize={7}
          onViewableItemsChanged={onVisible}
          viewabilityConfig={visibilityConfig}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onScroll={(event) => {
            const e = event.nativeEvent;
            autoScroll.current = e.contentOffset.y < 140;
            const distanceToHistory = e.contentSize.height - e.layoutMeasurement.height - e.contentOffset.y;
            if (e.contentOffset.y > 30 && distanceToHistory < 250 && hasNextPage) {
              if (isFetching) olderHistoryRequested.current = true;
              else void fetchNextPage({ cancelRefetch: false }).catch(() => {});
            } else olderHistoryRequested.current = false;
          }}
          onScrollToIndexFailed={({index, averageItemLength}) => {
            list.current?.scrollToOffset({offset: index * averageItemLength, animated: !reducedMotion});
          }}
          scrollEventThrottle={100}
          onContentSizeChange={() => {
            if (autoScroll.current)
              list.current?.scrollToOffset({ offset: 0, animated: historyLaidOut.current && !reducedMotion });
            historyLaidOut.current = true;
          }}
          ListFooterComponent={query.isFetchingNextPage ? (
            <ActivityIndicator color={String(theme.primary)} style={{ padding: 14 }} />
          ) : null}
          ListEmptyComponent={
            !query.isPending ? (
              <View style={{ padding: 40, alignItems: "center", gap: 10 }}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={42}
                  color={String(theme.primary)}
                />
                <AppText muted>{c.noMessages}</AppText>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ChatBubble
              item={item}
              room={room}
              onActions={(message, anchor) => {
                setActionAnchor(anchor ?? {x: 180, y: 180});
                setAction(message);
              }}
              onProfile={onProfile}
              onPhoto={setPhoto}
              onListened={(message) => {
                if (message.voiceListened) return;
                void chatApi.listen(token, message.id).then(() => {
                  void client.invalidateQueries({ queryKey: ["chat-messages", token, room.id] });
                }).catch(showError);
              }}
            />
          )}
          ListHeaderComponent={
            <>
              {room.systemKey === "news" ? <FeedAd placement="official-news"/> : null}
              {outbox.items.map((item) => (
                <View
                  key={item.clientId}
                  style={[
                    styles.pending,
                    { backgroundColor: theme.primarySoft },
                  ]}
                >
                  <AppText>{item.text || c.attach}</AppText>
                  <AppText variant="caption" muted>
                    {outbox.failed ? c.failed : c.pending}
                  </AppText>
                </View>
              ))}
              {outbox.failed ? (
                <ChatAction
                  title={c.retry}
                  onPress={() => {
                    void outbox.retry();
                  }}
                  icon="refresh"
                />
              ) : null}
            </>
          }
        />
        {typingUntil > 0 ? (
          <AppText variant="caption" muted style={{ paddingLeft: 16 }}>
            {c.typing}
          </AppText>
        ) : null}
        {error ? (
          <Pressable onPress={() => setError(null)} style={{ padding: 10 }}>
            <AppText accessibilityRole="alert" color={String(theme.danger)}>
              {error}
            </AppText>
          </Pressable>
        ) : null}
        {room.canPost && !needsFriend ? (
          <View
            style={[
              styles.composer,
              { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: 9 + (Platform.OS === "web" || keyboardVisible ? 0 : insets.bottom) },
            ]}
          >
            {reply || editing ? (
              <View style={styles.replyLine}>
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" color={String(theme.primary)}>
                    {editing ? c.edit : `${c.reply} · ${reply?.sender.name}`}
                  </AppText>
                  <AppText numberOfLines={1} muted>
                    {(editing || reply)?.text || c.attach}
                  </AppText>
                </View>
                <Pressable
                  accessibilityLabel={c.cancel}
                  onPress={() => {
                    setReply(null);
                    setEditing(null);
                    setText("");
                    setInputHeight(44);
                  }}
                  style={styles.icon}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={String(theme.primary)}
                  />
                </Pressable>
              </View>
            ) : null}
            {attachments.length ? <View style={{flexDirection: "row", flexWrap: "wrap", gap: 8}}>
              {attachments.map(a => <View key={a.id} style={{position: "relative", maxWidth: "100%"}}>
                {a.previewUri ? <Pressable accessibilityRole="button" accessibilityLabel={`${c.view}: ${a.name}`} onPress={() => setDraftPhoto(a.previewUri!)}>
                  <Image source={{uri: a.previewUri}} style={{width: 86, height: 86, borderRadius: 12}} />
                </Pressable> : <AppText variant="caption" style={{padding: 10, paddingRight: 32}}>📎 {a.name}</AppText>}
                <Pressable accessibilityRole="button" accessibilityLabel={`${c.removeAttachment}: ${a.name}`} onPress={() => setAttachments(current => current.filter(x => x.id !== a.id))} style={{position: "absolute", top: 3, right: 3, width: 24, height: 24, borderRadius: 12, backgroundColor: theme.surfaceRaised, alignItems: "center", justifyContent: "center"}}>
                  <Ionicons name="close" size={17} color={String(theme.text)} />
                </Pressable>
              </View>)}
            </View> : null}
            <View style={styles.composeLine}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={c.attach}
                disabled={
                  voiceActive ||
                  uploading ||
                  attachments.length >= 4 ||
                  Boolean(editing)
                }
                onPress={() => setAttachMenu(true)}
                style={styles.icon}
              >
                {uploading ? (
                  <ActivityIndicator color={String(theme.primary)} />
                ) : (
                  <Ionicons
                    name="add-circle-outline"
                    size={26}
                    color={String(theme.primary)}
                  />
                )}
              </Pressable>
              <TextInput
                ref={composerRef}
                accessibilityLabel={c.write}
                multiline
                submitBehavior="newline"
                onKeyPress={(event) => {
                  if (Platform.OS !== "web") return;
                  const key = event.nativeEvent as typeof event.nativeEvent & {
                    shiftKey?: boolean;
                    isComposing?: boolean;
                    keyCode?: number;
                  };
                  if (
                    key.key === "Enter" &&
                    !key.shiftKey &&
                    !key.isComposing &&
                    key.keyCode !== 229
                  ) {
                    event.preventDefault();
                    void send();
                  }
                }}
                blurOnSubmit={false}
                numberOfLines={1}
                onContentSizeChange={
                  Platform.OS === "web"
                    ? undefined
                    : (event) => {
                        const height = Math.min(
                          124,
                          Math.max(
                            44,
                            Math.ceil(event.nativeEvent.contentSize.height),
                          ),
                        );
                        setInputHeight((previous) =>
                          previous === height ? previous : height,
                        );
                      }
                }
                maxLength={4000}
                value={text}
                onChangeText={(value) => {
                  setText(value);
                  if (Platform.OS === "web")
                    setInputHeight(
                      Math.min(
                        124,
                        Math.max(44, 24 + value.split("\n").length * 20),
                      ),
                    );
                  if (value && Date.now() - typingSent.current > 4000) {
                    typingSent.current = Date.now();
                    void sendChatTyping(token, room.id).catch(() => {});
                  }
                }}
                placeholder={c.write}
                placeholderTextColor={theme.textMuted}
                style={[
                  ...inputStyle,
                  {
                    display: voiceActive ? "none" : "flex",
                    flex: 1,
                    height: text ? inputHeight : 44,
                    maxHeight: 124,
                    minHeight: 44,
                    lineHeight: 20,
                    paddingVertical: 10,
                    textAlignVertical: "top",
                  },
                ]}
              />
              {!text.trim() && !attachments.length && !editing ? (
                <VoiceRecorder
                  onActiveChange={setVoiceActive}
                  onFile={async (file) => {
                    const attachment = await chatApi.upload(token, file);
                    await outbox.enqueue("", [attachment.id], reply?.id);
                    setReply(null);
                    autoScroll.current = true;
                  }}
                  onError={showError}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={c.send}
                  disabled={busy || uploading}
                  onPress={() => {
                    void send();
                  }}
                  style={[styles.send, { backgroundColor: theme.primary }]}
                >
                  {busy ? (
                    <ActivityIndicator color={String(theme.onPrimary)} />
                  ) : (
                    <Ionicons
                      name="arrow-up"
                      size={23}
                      color={String(theme.onPrimary)}
                    />
                  )}
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.readOnly}>
            {needsFriend ? <><AppText muted>{c.friendsOnly}</AppText><ChatAction title={c.profile} icon="person-outline" onPress={()=>room.peer && onProfile(room.peer.id)} /></> : <AppText muted>{c.readOnly}</AppText>}
          </View>
        )}
        {attachMenu ? (
          <ChatSheet title={c.attach} onClose={() => setAttachMenu(false)}>
            <ChatAction
              title={c.photo}
              icon="image-outline"
              onPress={() => {
                void pick("photo");
              }}
            />
            <ChatAction
              title={c.file}
              icon="document-outline"
              onPress={() => {
                void pick("file");
              }}
            />
          </ChatSheet>
        ) : null}
        {action ? (
          <ChatPopover anchor={actionAnchor} onClose={() => setAction(null)}>
            {!action.deleted ? (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                {["👍", "❤️", "😂", "🔥", "🎉", "😢"].map((emoji) => (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={emoji}
                    disabled={busy}
                    onPress={() => {
                      void reactToMessage(action, emoji);
                    }}
                    style={styles.icon}
                  >
                    <AppText style={{ fontSize: 25 }}>{emoji}</AppText>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {!action.deleted && room.canPost ? (
              <ChatAction
                title={c.reply}
                icon="return-up-back"
                onPress={() => {
                  setReply(action);
                  setEditing(null);
                  setAction(null);
                  composerRef.current?.focus();
                }}
              />
            ) : null}
            {!action.deleted ? (
              <ChatAction
                title={c.forward}
                icon="arrow-redo-outline"
                onPress={() => {
                  setForward({
                    message: action,
                    clientId: Crypto.randomUUID(),
                  });
                  setAction(null);
                }}
              />
            ) : null}
            {!action.deleted ? (
              <ChatAction
                title={c.share}
                icon="share-outline"
                onPress={() => {
                  void run(() => share(action));
                }}
              />
            ) : null}
            {action.own && !action.deleted ? (
              <ChatAction
                title={c.edit}
                icon="pencil-outline"
                onPress={() => {
                  setEditing(action);
                  setText(action.text);
                  setAction(null);
                }}
              />
            ) : null}
            {room.canManage && !action.deleted ? (
              <ChatAction
                title={action.pinned ? c.unpin : c.pin}
                icon="pin-outline"
                onPress={() => {
                  void run(() =>
                    chatApi.change(token, action.id, {
                      pinned: !action.pinned,
                    }),
                  );
                }}
              />
            ) : null}
            <ChatAction title={c.deleteMessage} danger icon="trash-outline" onPress={() => { setDeleting(action); setAction(null); }} />
            {!action.own ? (
              <ChatAction
                title={c.report}
                danger
                icon="flag-outline"
                onPress={() => {
                  setReport(action);
                  setAction(null);
                }}
              />
            ) : null}
          </ChatPopover>
        ) : null}
        {deleting ? <ChatSheet title={c.deleteMessage} onClose={() => setDeleting(null)}>
          <ChatAction title={c.hide} icon="person-outline" disabled={busy} onPress={() => void run(async () => { await chatApi.change(token, deleting.id, {remove: "self"}); setDeleting(null); })} />
          {(deleting.own || room.canManage) && !deleting.deleted ? <ChatAction title={room.kind === "direct" || room.kind === "support" ? `${c.deleteForBoth} ${room.peer?.name ?? c.support}` : c.remove} icon="people-outline" danger disabled={busy} onPress={() => void run(async () => { await chatApi.change(token, deleting.id, {remove: "all"}); setDeleting(null); })} /> : null}
          {error ? <AppText accessibilityRole="alert" color={String(theme.danger)}>{error}</AppText> : null}
        </ChatSheet> : null}
        {forward ? (
          <ChatSheet title={c.choose} onClose={() => setForward(null)}>
            <TextInput
              value={forwardSearch}
              onChangeText={setForwardSearch}
              placeholder={c.search}
              placeholderTextColor={theme.textMuted}
              style={inputStyle}
            />
            {forwardResults.data?.users.map((person) => (
              <ChatAction
                key={person.id}
                title={person.name}
                disabled={busy}
                onPress={() => {
                  void run(async () => {
                    const target = await chatApi.direct(token, person.id);
                    await chatApi.send(token, target.id, {
                      clientId: forward.clientId,
                      forwardId: forward.message.id,
                    });
                    setForward(null);
                  });
                }}
              />
            ))}
            {chats
              .filter((r) => r.canPost)
              .map((r) => (
                <ChatAction
                  key={r.id}
                  title={r.title}
                  disabled={busy}
                  onPress={() => {
                    void forwardTo(r.id);
                  }}
                />
              ))}
          </ChatSheet>
        ) : null}
        {report ? (
          <ChatSheet title={c.report} onClose={() => setReport(null)}>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={c.reportReason}
              placeholderTextColor={theme.textMuted}
              style={inputStyle}
              maxLength={500}
              multiline
            />
            <ChatAction
              title={c.send}
              disabled={busy || !reason.trim()}
              onPress={() => {
                void run(async () => {
                  await chatApi.change(token, report.id, { report: reason });
                  setReport(null);
                  setReason("");
                });
              }}
            />
          </ChatSheet>
        ) : null}
        {chatMenu ? (
          <View style={[StyleSheet.absoluteFill, { zIndex: 30 }]}>
            <Pressable
              accessibilityLabel={c.cancel}
              onPress={() => setChatMenu(false)}
              style={StyleSheet.absoluteFill}
            />
            <MotionEntrance
              style={{
                position: "absolute",
                right: 16,
                top: headerHeight - 2,
                width: 280,
                maxWidth: "90%",
                borderRadius: 18,
                padding: 6,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surfaceRaised,
                boxShadow: "0px 8px 28px rgba(0,0,0,0.16)",
              }}
            >
              <ChatAction title={c.chatThemes} icon="color-palette-outline" onPress={() => { setChatMenu(false); setThemesOpen(true); }} />
              <ChatAction
                title={c.searchShort}
                icon="search-outline"
                onPress={() => {
                  setChatMenu(false);
                  setShowSearch(true);
                }}
              />
              <ChatAction
                title={
                  (room.canEditInfo ?? room.canManage) &&
                  ["group", "channel"].includes(room.kind)
                    ? c.settings
                    : c.profile
                }
                icon="person-circle-outline"
                onPress={() => {
                  setChatMenu(false);
                  onInfo();
                }}
              />
              {room.canManage &&
              !room.systemKey &&
              ["group", "channel"].includes(room.kind) ? (
                <ChatAction
                  title={c.addMembers}
                  icon="person-add-outline"
                  onPress={() => {
                    setChatMenu(false);
                    onInfo();
                  }}
                />
              ) : null}
              <ChatAction
                title={room.muted ? c.unmute : c.mute}
                icon="notifications-outline"
                onPress={() => {
                  setChatMenu(false);
                  void run(() =>
                    chatApi.member(token, room.id, { muted: !room.muted }),
                  );
                }}
              />
              <ChatAction
                title={room.pinned ? c.unpin : c.pin}
                icon="pin-outline"
                onPress={() => {
                  setChatMenu(false);
                  void run(() =>
                    chatApi.member(token, room.id, { pinned: !room.pinned }),
                  );
                }}
              />
            </MotionEntrance>
          </View>
        ) : null}
        {themesOpen ? <ChatSheet title={c.chatThemes} onClose={() => setThemesOpen(false)}>
          <View style={{flexDirection: "row", flexWrap: "wrap", gap: 10}}>
          {([
            ["system", c.themeSystem], ["green", c.themeGreen], ["blue", c.themeBlue], ["pink", c.themePink], ["graphite", c.themeGraphite],
          ] as const).map(([preset, label]) => <ChatThemePreview key={preset} appearance={{preset}} label={label} selected={(room.chatTheme?.preset ?? "system") === preset} disabled={busy} onPress={() => void run(async () => { await chatApi.theme(token, room.id, preset); setThemesOpen(false); })} />)}
          {room.chatTheme?.wallpaperUrl ? <ChatThemePreview appearance={{...room.chatTheme, preset: "custom"}} label={c.themeCustom} selected={room.chatTheme.preset === "custom"} disabled={busy} onPress={() => void run(async () => { await chatApi.theme(token, room.id, "custom"); setThemesOpen(false); })} /> : null}
          </View>
          <ChatAction title={room.chatTheme?.wallpaperUrl ? c.themeChangePhoto : c.themePhoto} icon="image-outline" disabled={busy} onPress={() => {
            void (async () => {
              try {
                const file = await pickChatPhoto();
                if (!file) return;
                await run(async () => { const photo = await chatApi.upload(token, file); await chatApi.theme(token, room.id, "custom", photo.id); setThemesOpen(false); });
              } catch (error) { showError(error); }
            })();
          }} />
          {error ? <AppText accessibilityRole="alert" color={String(theme.danger)}>{error}</AppText> : null}
        </ChatSheet> : null}
        {draftPhoto ? <ChatSheet title={c.photo} onClose={() => setDraftPhoto(null)}><Image source={{uri: draftPhoto}} resizeMode="contain" style={{width: "100%", height: 350}} /></ChatSheet> : null}
        {photo ? (
          <ChatSheet title={photo.name} onClose={() => setPhoto(null)}>
            <Image
              source={{ uri: chatMediaUrl(photo.url) }}
              resizeMode="contain"
              style={{ width: "100%", height: 350 }}
            />
            <ChatAction
              title={c.share}
              icon="share-outline"
              onPress={() => {
                void shareChatFile(
                  chatMediaUrl(photo.url),
                  photo.name,
                  photo.mime,
                ).catch(showError);
              }}
            />
          </ChatSheet>
        ) : null}
      </KeyboardAvoidingView>
    </MotionEntrance>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, minHeight: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 4,
  },
  person: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  icon: {
    minWidth: 40,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  history: {
    padding: 14,
    paddingBottom: 20,
    flexGrow: 1,
    justifyContent: "flex-start",
  },
  input: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 11,
    fontSize: 15,
  },
  composer: {
    borderTopWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 16,
    gap: 8,
  },
  composeLine: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  replyLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 10,
  },
  readOnly: { alignItems: "center", padding: 18 },
  pending: {
    alignSelf: "flex-end",
    padding: 12,
    borderRadius: 18,
    gap: 5,
    maxWidth: "80%",
    marginVertical: 5,
  },
});
