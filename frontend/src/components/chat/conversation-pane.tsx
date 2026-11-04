import {
  watchChatConversation,
  subscribeToChallengeUpdates,
  sendChatTyping,
} from "@/lib/challenge-live-updates";
import { dismissInboxNotifications } from "@/lib/notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
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

export function ConversationPane({
  room,
  token,
  accountId,
  chats,
  onBack,
  onProfile,
  onInfo,
}: {
  room: ChatRoom;
  token: string;
  accountId: string;
  chats: ChatRoom[];
  onBack: () => void;
  onProfile: (id: string) => void;
  onInfo: () => void;
}) {
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
    [searchDraft, setSearchDraft] = useState(""),
    [search, setSearch] = useState(""),
    [showSearch, setShowSearch] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchDraft.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchDraft]);
  const [reply, setReply] = useState<ChatItem | null>(null),
    [editing, setEditing] = useState<ChatItem | null>(null),
    [action, setAction] = useState<ChatItem | null>(null);
  const [forward, setForward] = useState<{
      message: ChatItem;
      clientId: string;
    } | null>(null),
    [forwardSearch, setForwardSearch] = useState("");
  const [report, setReport] = useState<ChatItem | null>(null),
    [reason, setReason] = useState(""),
    [photo, setPhoto] = useState<ChatFile | null>(null);
  const [attachments, setAttachments] = useState<
      { id: string; name: string }[]
    >([]),
    [uploading, setUploading] = useState(false),
    [busy, setBusy] = useState(false),
    [attachMenu, setAttachMenu] = useState(false);
  const list = useRef<FlatList<ChatItem>>(null),
    autoScroll = useRef(true),
    readSeq = useRef(0);
  const query = useInfiniteQuery({
    queryKey: ["chat-messages", token, room.id, search],
    queryFn: ({ pageParam }) =>
      chatApi.messages(token, room.id, pageParam, search || undefined),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.before ?? undefined,
    refetchInterval: 15_000,
    staleTime: 3000,
  });
  const items = useMemo(() => {
    const map = new Map<string, ChatItem>();
    for (const page of [...(query.data?.pages ?? [])].reverse())
      for (const item of page.items) map.set(item.id, item);
    return [...map.values()].sort((a, b) => a.seq - b.seq);
  }, [query.data]);
  const refresh = useCallback(() => {
    void client.invalidateQueries({
      queryKey: ["chat-messages", token, room.id],
    });
    void client.invalidateQueries({ queryKey: ["chat-list", token] });
  }, [client, token, room.id]);
  const outbox = useChatOutbox(token, accountId, room.id, refresh);
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
  const upload = async (file: ChatDraftFile) => {
    setUploading(true);
    setError(null);
    try {
      const a = await chatApi.upload(token, file);
      setAttachments((current) => [...current, a].slice(0, 4));
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
  const visible = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<ChatItem>[] }) => {
      if (search || AppState.currentState !== "active") return;
      const seq = Math.max(
        0,
        ...viewableItems.filter((v) => v.isViewable).map((v) => v.item.seq),
      );
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
  const visibleHandler = useRef(visible);
  useEffect(() => { visibleHandler.current = visible; }, [visible]);
  const onVisible = useCallback((info: { viewableItems: ViewToken<ChatItem>[] }) => visibleHandler.current(info), []);
  const visibilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 50 }), []);
  const inputStyle = [
    styles.input,
    {
      color: theme.text,
      backgroundColor: theme.surfaceRaised,
      borderColor: theme.border,
    },
  ];
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.page, { backgroundColor: theme.background }]}
    >
      <View
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
          onPress={room.peer ? () => onProfile(room.peer!.id) : onInfo}
          style={styles.person}
        >
          <Avatar
            name={room.title}
            avatarUrl={
              room.peer?.avatarUrl ??
              (room.avatarUrl ? chatMediaUrl(room.avatarUrl) : null)
            }
            size={42}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="heading" numberOfLines={1}>
              {room.systemKey === "news"
                ? c.news
                : room.systemKey === "community"
                  ? c.community
                  : room.kind === "support" && !room.peer?.name
                    ? c.support
                    : room.title}
            </AppText>
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
          accessibilityLabel={c.textSearch}
          onPress={() => {
            setShowSearch(!showSearch);
            setSearch("");
            setSearchDraft("");
          }}
          style={styles.icon}
        >
          <Ionicons
            name="search-outline"
            size={22}
            color={String(theme.primary)}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={c.settings}
          onPress={onInfo}
          style={styles.icon}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={22}
            color={String(theme.primary)}
          />
        </Pressable>
      </View>
      {showSearch ? (
        <TextInput
          accessibilityLabel={c.textSearch}
          value={searchDraft}
          onChangeText={setSearchDraft}
          placeholder={c.textSearch}
          placeholderTextColor={theme.textMuted}
          style={[...inputStyle, { margin: 10 }]}
        />
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
        data={items}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={styles.history}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        windowSize={7}
        onViewableItemsChanged={onVisible}
        viewabilityConfig={visibilityConfig}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onScroll={(event) => {
          const e = event.nativeEvent;
          autoScroll.current =
            e.contentSize.height -
              e.layoutMeasurement.height -
              e.contentOffset.y <
            140;
        }}
        scrollEventThrottle={100}
        onContentSizeChange={() => {
          if (autoScroll.current)
            list.current?.scrollToEnd({ animated: false });
        }}
        ListHeaderComponent={
          query.hasNextPage ? (
            <ChatAction
              disabled={query.isFetchingNextPage}
              title={c.earlier}
              icon="chevron-up"
              onPress={() => {
                autoScroll.current = false;
                void query.fetchNextPage();
              }}
            />
          ) : null
        }
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
            onActions={setAction}
            onProfile={onProfile}
            onPhoto={setPhoto}
          />
        )}
        ListFooterComponent={
          <>
            {outbox.items.map((item) => (
              <View
                key={item.clientId}
                style={[styles.pending, { backgroundColor: theme.primarySoft }]}
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
      {room.canPost ? (
        <View
          style={[
            styles.composer,
            { backgroundColor: theme.surface, borderTopColor: theme.border },
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
          {attachments.map((a) => (
            <Pressable
              key={a.id}
              onPress={() =>
                setAttachments((current) =>
                  current.filter((x) => x.id !== a.id),
                )
              }
            >
              <AppText variant="caption">📎 {a.name} ×</AppText>
            </Pressable>
          ))}
          <View style={styles.composeLine}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={c.attach}
              disabled={
                uploading || attachments.length >= 4 || Boolean(editing)
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
              accessibilityLabel={c.write}
              multiline
              maxLength={4000}
              value={text}
              onChangeText={(value) => {
                setText(value);
                if (value && Date.now() - typingSent.current > 4000) {
                  typingSent.current = Date.now();
                  void sendChatTyping(token, room.id).catch(() => {});
                }
              }}
              placeholder={c.write}
              placeholderTextColor={theme.textMuted}
              style={[
                ...inputStyle,
                { flex: 1, maxHeight: 110, minHeight: 44 },
              ]}
            />
            {!text.trim() && !attachments.length && !editing ? (
              <VoiceRecorder onFile={upload} onError={showError} />
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
          <AppText muted>{c.readOnly}</AppText>
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
          <AppText variant="caption" muted>
            {c.fileLimit}
          </AppText>
        </ChatSheet>
      ) : null}
      {action ? (
        <ChatSheet title={c.messageActions} onClose={() => setAction(null)}>
          {!action.deleted ? (
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              {["👍", "❤️", "😂", "🔥", "🎉", "😢"].map((emoji) => (
                <Pressable
                  key={emoji}
                  accessibilityLabel={emoji}
                  disabled={busy}
                  onPress={() => {
                    void run(() =>
                      chatApi.change(token, action.id, {
                        emoji: action.reactions.some(
                          (r) => r.userId === accountId && r.emoji === emoji,
                        )
                          ? ""
                          : emoji,
                      }),
                    );
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
              }}
            />
          ) : null}
          {!action.deleted ? (
            <ChatAction
              title={c.forward}
              icon="arrow-redo-outline"
              onPress={() => {
                setForward({ message: action, clientId: Crypto.randomUUID() });
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
                  chatApi.change(token, action.id, { pinned: !action.pinned }),
                );
              }}
            />
          ) : null}
          <ChatAction
            title={c.hide}
            icon="eye-off-outline"
            onPress={() => {
              void run(() =>
                chatApi.change(token, action.id, { remove: "self" }),
              );
            }}
          />
          {(action.own || room.canManage) && !action.deleted ? (
            <ChatAction
              title={c.remove}
              danger
              icon="trash-outline"
              onPress={() => {
                void run(() =>
                  chatApi.change(token, action.id, { remove: "all" }),
                );
              }}
            />
          ) : null}
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
        </ChatSheet>
      ) : null}
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
  history: { padding: 14, paddingBottom: 20, flexGrow: 1 },
  input: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 11,
    fontSize: 15,
  },
  composer: { borderTopWidth: 1, padding: 9, gap: 7 },
  composeLine: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
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
