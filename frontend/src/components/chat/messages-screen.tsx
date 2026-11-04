import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MotionEntrance } from "@/components/motion-entrance";
import { ProfileDrawer } from "@/components/profile-drawer";
import { OfficialBadge } from "./official-badge";
import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useAppStore } from "@/store/app-store";
import { chatApi, chatMediaUrl, type ChatRoom } from "@/lib/chat-api";
import { useChatCopy } from "@/lib/chat-copy";
import { ConversationPane } from "./conversation-pane";
import { ChatAction, ChatSheet } from "./chat-sheet";
import { ChatRoomInfo } from "./chat-room-info";

export function MessagesScreen() {
  const theme = useAppTheme(),
    c = useChatCopy(),
    router = useRouter(),
    params = useLocalSearchParams<{ chat?: string; invite?: string }>(),
    { isDesktop } = useResponsiveLayout();
  const token = useAppStore((s) => s.accessToken),
    user = useAppStore((s) => s.user),
    focused = useIsFocused(),
    client = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [creating, setCreating] = useState<
      "menu" | "direct" | "group" | "channel" | null
    >(null);
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [visibility, setVisibility] = useState<"public" | "invite">("invite"),
    [info, setInfo] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
        setKeyboardOpen(true),
      ),
      hide = Keyboard.addListener("keyboardDidHide", () =>
        setKeyboardOpen(false),
      );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const query = useQuery({
    queryKey: ["chat-list", token],
    enabled: Boolean(token),
    queryFn: () => chatApi.list(token!),
    staleTime: 15_000,
    refetchInterval: focused ? 30_000 : false,
  });
  const found = useQuery({
    queryKey: ["chat-search", token, debounced],
    enabled: Boolean(token && debounced.length >= 2),
    queryFn: () => chatApi.search(token!, debounced),
    staleTime: 15_000,
  });
  const chats = useMemo(
    () =>
      [...(query.data?.chats ?? [])].sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          Number(Boolean(b.systemKey || b.kind === "support")) -
            Number(Boolean(a.systemKey || a.kind === "support")) ||
          Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt),
      ),
    [query.data],
  );
  const selected = chats.find((room) => room.id === params.chat);
  const roomTitle = (room: ChatRoom) =>
    room.systemKey === "news"
      ? c.news
      : room.systemKey === "community"
        ? c.community
        : room.kind === "support" && user.role !== "admin"
          ? c.support
          : room.title;
  const shown = chats.filter(
    (room) =>
      (filter === "all" ||
        (filter === "direct" && ["direct", "support"].includes(room.kind)) ||
        (filter === "group" && room.kind === "group") ||
        (filter === "channel" && room.kind === "channel")) &&
      (!debounced ||
        roomTitle(room).toLowerCase().includes(debounced.toLowerCase())),
  );
  const open = useCallback(
    (id: string) => {
      router.setParams({ chat: id, invite: "" });
      setCreating(null);
      setSearch("");
      Keyboard.dismiss();
    },
    [router],
  );
  const execute = async (task: () => Promise<{ id: string }>) => {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await task();
      await query.refetch();
      open(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : c.error);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!token || !params.invite || !/^[A-Za-z0-9_-]{24}$/.test(params.invite))
      return;
    let cancelled = false;
    void chatApi
      .join(token, params.invite)
      .then(async (result) => {
        if (!cancelled) {
          await client.invalidateQueries({ queryKey: ["chat-list", token] });
          open(result.id);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : c.error);
      });
    return () => {
      cancelled = true;
    };
  }, [token, params.invite, client, open, c.error]);
  const profile = (id: string) => router.push(`/player/${id}` as never);
  const input = [
    styles.input,
    {
      color: theme.text,
      backgroundColor: theme.surfaceRaised,
      borderColor: theme.border,
    },
  ];
  if (!token)
    return (
      <AppFrame>
        <AppText>{c.emptyBody}</AppText>
        <ChatAction title={c.profile} onPress={() => router.push("/login")} />
      </AppFrame>
    );
  return (
    <AppFrame
      scroll={false}
      noPadding
      wide
      swipesDisabled
      contentStyle={{
        flex: 1,
        minHeight: 0,
        paddingTop: isDesktop ? 15 : 0,
        maxWidth: 1600,
        paddingLeft: isDesktop ? 150 : 0,
        paddingRight: isDesktop ? 24 : 0,
        paddingBottom: keyboardOpen ? 0 : isDesktop ? 24 : 112,
      }}
    >
      <View
        style={[
          styles.shell,
          { backgroundColor: theme.surface, borderColor: theme.border },
          isDesktop && styles.desktop,
        ]}
      >
        {isDesktop || !selected ? (
          <View
            style={[
              styles.sidebar,
              isDesktop
                ? {
                    width: 360,
                    flexShrink: 0,
                    borderRightWidth: 1,
                    borderRightColor: theme.border,
                  }
                : { flex: 1 },
            ]}
          >
            <View style={styles.top}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={c.profile}
                onPress={() => setDrawerOpen(true)}
                style={styles.avatar}
              >
                <Avatar name={user.name} avatarUrl={user.avatarUrl} size={43} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <AppText variant="title">{c.title}</AppText>
                <AppText variant="caption" muted numberOfLines={1}>
                  {user.username ? `@${user.username}` : c.groupHint}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={c.newChat}
                onPress={() => setCreating("menu")}
                style={styles.icon}
              >
                <Ionicons
                  name="create-outline"
                  size={23}
                  color={String(theme.primary)}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={c.settings}
                onPress={() => router.push("/settings")}
                style={styles.icon}
              >
                <Ionicons
                  name="settings-outline"
                  size={23}
                  color={String(theme.primary)}
                />
              </Pressable>
            </View>
            <View
              style={[styles.search, { backgroundColor: theme.surfaceRaised }]}
            >
              <Ionicons
                name="search-outline"
                size={19}
                color={String(theme.textMuted)}
              />
              <TextInput
                accessibilityLabel={c.search}
                value={search}
                onChangeText={setSearch}
                placeholder={c.search}
                placeholderTextColor={theme.textMuted}
                style={{
                  flex: 1,
                  color: theme.text,
                  minHeight: 42,
                  fontSize: 14,
                }}
              />
              {search ? (
                <Pressable
                  accessibilityLabel={c.cancel}
                  onPress={() => setSearch("")}
                >
                  <Ionicons
                    name="close-circle"
                    size={19}
                    color={String(theme.textMuted)}
                  />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.filters}>
              {[
                ["all", c.all],
                ["direct", c.direct],
                ["group", c.groups],
                ["channel", c.channels],
              ].map(([key, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === key }}
                  onPress={() => setFilter(key!)}
                  style={[
                    styles.filter,
                    filter === key && { backgroundColor: theme.primarySoft },
                  ]}
                >
                  <AppText
                    variant="caption"
                    color={String(
                      filter === key ? theme.primary : theme.textMuted,
                    )}
                  >
                    {label}
                  </AppText>
                </Pressable>
              ))}
            </View>
            {query.isPending ? (
              <ActivityIndicator
                color={String(theme.primary)}
                style={{ padding: 20 }}
              />
            ) : null}
            {query.isError ? (
              <ChatAction
                title={c.retry}
                icon="refresh"
                onPress={() => {
                  void query.refetch();
                }}
              />
            ) : null}
            <FlatList
              data={shown}
              keyExtractor={(room) => room.id}
              contentContainerStyle={{ paddingBottom: 15 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: room }) => (
                <MotionEntrance
                  style={[
                    styles.chatRow,
                    {
                      backgroundColor:
                        selected?.id === room.id
                          ? theme.primarySoft
                          : "transparent",
                    },
                  ]}
                >
                  {room.peer || room.avatarUrl ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={c.profile}
                      onPress={() =>
                        room.peer ? profile(room.peer.id) : open(room.id)
                      }
                    >
                      <Avatar
                        name={room.title}
                        avatarUrl={
                          room.peer?.avatarUrl ??
                          (room.avatarUrl ? chatMediaUrl(room.avatarUrl) : null)
                        }
                        size={52}
                      />
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={roomTitle(room)}
                      onPress={() => open(room.id)}
                      style={[
                        styles.systemIcon,
                        { backgroundColor: theme.primarySoft },
                      ]}
                    >
                      <Ionicons
                        name={
                          room.systemKey === "news" || room.kind === "channel"
                            ? "megaphone-outline"
                            : room.kind === "support"
                              ? "headset-outline"
                              : "people-outline"
                        }
                        size={25}
                        color={String(theme.primary)}
                      />
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={roomTitle(room)}
                    onPress={() => open(room.id)}
                    style={{ flex: 1, gap: 6 }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <AppText
                        variant="label"
                        numberOfLines={1}
                        style={{ flex: 1 }}
                      >
                        {roomTitle(room)}
                      </AppText>
                      {room.systemKey || room.kind === "support" ? (
                        <OfficialBadge />
                      ) : null}
                      {room.pinned ? (
                        <Ionicons
                          name="pin"
                          size={12}
                          color={String(theme.textMuted)}
                        />
                      ) : null}
                      <AppText variant="caption" muted>
                        {room.lastSeq
                          ? new Date(room.lastMessageAt).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              },
                            )
                          : ""}
                      </AppText>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <AppText
                        variant="caption"
                        muted
                        numberOfLines={1}
                        style={{ flex: 1 }}
                      >
                        {room.preview ||
                          (room.hasAttachment
                            ? `📎 ${c.attach}`
                            : room.kind === "support"
                              ? c.support
                              : c.noMessages)}
                      </AppText>
                      {room.unread ? (
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: room.muted
                                ? theme.textMuted
                                : theme.primary,
                            },
                          ]}
                        >
                          <AppText
                            style={{
                              color: theme.onPrimary,
                              fontSize: 11,
                              fontWeight: "700",
                            }}
                          >
                            {room.unread > 99 ? "99+" : room.unread}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                </MotionEntrance>
              )}
              ListFooterComponent={
                debounced.length >= 2 ? (
                  <View style={{ padding: 14, gap: 5 }}>
                    {found.data?.users.map((person) => (
                      <View key={person.id} style={styles.person}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => profile(person.id)}
                        >
                          <Avatar
                            name={person.name}
                            avatarUrl={person.avatarUrl}
                            size={40}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => profile(person.id)}
                          style={{ flex: 1 }}
                        >
                          <AppText variant="label">{person.name}</AppText>
                          <AppText variant="caption" muted>
                            {person.username
                              ? `@${person.username}`
                              : person.id}
                          </AppText>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={c.newChat}
                          onPress={() => {
                            void execute(() =>
                              chatApi.direct(token, person.id),
                            );
                          }}
                        >
                          <Ionicons
                            name="chatbubble-outline"
                            size={24}
                            color={String(theme.primary)}
                          />
                        </Pressable>
                      </View>
                    ))}
                    {found.data?.rooms.map((room) => (
                      <ChatAction
                        key={room.id}
                        title={`${room.title} · ${c.join}`}
                        disabled={busy}
                        onPress={() => {
                          void execute(() =>
                            chatApi.join(token, room.inviteCode),
                          );
                        }}
                      />
                    ))}
                  </View>
                ) : null
              }
            />
          </View>
        ) : null}
        {selected ? (
          <View style={{ flex: 1, minWidth: 0 }}>
            <ConversationPane
              key={selected.id}
              room={{ ...selected, title: roomTitle(selected) }}
              token={token}
              accountId={user.id ?? ""}
              chats={chats}
              onBack={() => router.setParams({ chat: "" })}
              onProfile={profile}
              onInfo={() => setInfo(true)}
            />
          </View>
        ) : isDesktop ? (
          <View style={styles.empty}>
            <View
              style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={45}
                color={String(theme.primary)}
              />
            </View>
            <AppText variant="title">{c.empty}</AppText>
            <AppText muted style={{ textAlign: "center", maxWidth: 300 }}>
              {c.emptyBody}
            </AppText>
            <ChatAction
              title={c.newChat}
              icon="create-outline"
              onPress={() => setCreating("direct")}
            />
          </View>
        ) : null}
      </View>
      {error ? (
        <Pressable style={{ padding: 10 }} onPress={() => setError(null)}>
          <AppText color={String(theme.danger)}>{error}</AppText>
        </Pressable>
      ) : null}
      {creating ? (
        <ChatSheet
          title={
            creating === "group"
              ? c.newGroup
              : creating === "channel"
                ? c.newChannel
                : c.newChat
          }
          onClose={() => setCreating(null)}
        >
          {creating === "menu" ? (
            <>
              <ChatAction
                title={c.newChat}
                icon="chatbubble-outline"
                onPress={() => setCreating("direct")}
              />
              <ChatAction
                title={c.newGroup}
                icon="people-outline"
                onPress={() => setCreating("group")}
              />
              <ChatAction
                title={c.newChannel}
                icon="megaphone-outline"
                onPress={() => setCreating("channel")}
              />
            </>
          ) : creating === "direct" ? (
            <>
              <TextInput
                autoFocus
                value={search}
                onChangeText={setSearch}
                placeholder={c.search}
                placeholderTextColor={theme.textMuted}
                style={input}
              />
              {found.data?.users.map((person) => (
                <ChatAction
                  key={person.id}
                  title={`${person.name}${person.username ? ` · @${person.username}` : ""}`}
                  disabled={busy}
                  onPress={() => {
                    void execute(() => chatApi.direct(token, person.id));
                  }}
                />
              ))}
            </>
          ) : (
            <>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={c.name}
                placeholderTextColor={theme.textMuted}
                maxLength={100}
                style={input}
              />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={c.description}
                placeholderTextColor={theme.textMuted}
                maxLength={1000}
                multiline
                style={input}
              />
              <ChatAction
                title={`${visibility === "public" ? "●" : "○"} ${c.publicRoom}`}
                onPress={() => setVisibility("public")}
              />
              <ChatAction
                title={`${visibility === "invite" ? "●" : "○"} ${c.privateRoom}`}
                onPress={() => setVisibility("invite")}
              />
              <ChatAction
                title={c.create}
                icon="add"
                disabled={!title.trim() || busy}
                onPress={() => {
                  void execute(() =>
                    chatApi.create(token, {
                      kind: creating,
                      title: title.trim(),
                      description,
                      visibility,
                    }),
                  );
                }}
              />
            </>
          )}
          {busy ? <ActivityIndicator color={String(theme.primary)} /> : null}
          {error ? (
            <AppText color={String(theme.danger)}>{error}</AppText>
          ) : null}
        </ChatSheet>
      ) : null}
      {info && selected ? (
        <ChatRoomInfo
          room={selected}
          token={token}
          accountId={user.id ?? ""}
          onClose={() => setInfo(false)}
          onLeave={() => router.setParams({ chat: "" })}
        />
      ) : null}
      <ProfileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSettings={() => router.push("/settings")}
        onInvite={() => router.push("/invite")}
      />
    </AppFrame>
  );
}
const styles = StyleSheet.create({
  shell: { flex: 1, minHeight: 0, overflow: "hidden" },
  desktop: { flexDirection: "row", borderWidth: 1, borderRadius: 26 },
  sidebar: { minHeight: 0 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    paddingBottom: 12,
  },
  avatar: { marginRight: 2 },
  icon: {
    width: 36,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    marginHorizontal: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filters: { flexDirection: "row", gap: 4, padding: 12, paddingHorizontal: 16 },
  filter: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 14 },
  chatRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 82,
  },
  systemIcon: {
    width: 52,
    height: 52,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 15,
  },
  emptyIcon: {
    width: 95,
    height: 95,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    fontSize: 15,
    minHeight: 48,
  },
});
