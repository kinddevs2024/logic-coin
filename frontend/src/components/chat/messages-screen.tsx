import {playerProfileRoute} from "@/lib/player-profile-navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import {
  Animated,
  BackHandler,
  Easing,
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  PanResponder,
  type ViewStyle,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MotionEntrance } from "@/components/motion-entrance";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileDrawer } from "@/components/profile-drawer";
import { OfficialBadge } from "./official-badge";
import { useDismissSearch } from "./use-dismiss-search";
import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { LogoMark } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useAppStore } from "@/store/app-store";
import { chatApi, chatMediaUrl, type ChatRoom } from "@/lib/chat-api";
import { useChatCopy } from "@/lib/chat-copy";
import { ConversationPane } from "./conversation-pane";
import { ChatAction, ChatSheet } from "./chat-sheet";
import { ApiError, meApi } from "@/lib/api";
import {InviteFriendsSheet} from "./invite-friends-sheet";
import { ChatRoomInfo } from "./chat-room-info";

export function MessagesScreen() {
  const theme = useAppTheme(),
    c = useChatCopy(),
    router = useRouter(),
    params = useLocalSearchParams<{
      chat?: string;
      invite?: string;
      messageSearch?: string;
    }>(),
    { isDesktop } = useResponsiveLayout();
  const token = useAppStore((s) => s.accessToken),
    user = useAppStore((s) => s.user),
    focused = useIsFocused(),
    client = useQueryClient();
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameDismissed, setNicknameDismissed] = useState(false);
  const insets = useSafeAreaInsets();
  const chatOpen = Boolean(params.chat);
  const ChatTransition = Platform.OS === "web" && isDesktop ? MotionEntrance : View;
  const closeConversation = useCallback(() => {
    Keyboard.dismiss();
    router.setParams({ chat: "", messageSearch: "" });
  }, [router]);
  useEffect(() => {
    if (!focused || !chatOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeConversation(); return true;
    });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.repeat && !event.defaultPrevented && !document.querySelector('[aria-modal="true"], dialog[open]')) { event.preventDefault(); closeConversation(); }
    };
    if (Platform.OS === "web") {
      window.addEventListener("keydown", keydown);
    }
    return () => {
      subscription.remove();
      if (Platform.OS === "web") {
        window.removeEventListener("keydown", keydown);
      }
    };
  }, [chatOpen, focused, closeConversation]);

  const [invitingFriends,setInvitingFriends]=useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchWidth, setSearchWidth] = useState(320);
  const searchBox = useRef<View>(null);
  const [searchMotion] = useState(() => new Animated.Value(0));
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const animation = Animated.timing(searchMotion, {
      toValue: searchOpen ? 1 : 0,
      duration: reducedMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [searchOpen, searchMotion, reducedMotion]);
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [creating, setCreating] = useState<
      "menu" | "direct" | "group" | "channel" | null
    >(null);
  const [folderMotion] = useState(() => new Animated.Value(1));
  const [folderBounds, setFolderBounds] = useState<Record<string, {x:number;y:number;width:number;height:number}>>({});
  const [folderIndicator] = useState(() => ({x:new Animated.Value(0),y:new Animated.Value(0),width:new Animated.Value(0),height:new Animated.Value(0)}));
  const indicatorReady = useRef(false);
  useEffect(() => {
    const bounds = folderBounds[filter];
    if (!bounds) return;
    const duration = reducedMotion || !indicatorReady.current ? 0 : 220;
    indicatorReady.current = true;
    const animation = Animated.parallel((Object.keys(folderIndicator) as (keyof typeof folderIndicator)[]).map(key =>
      Animated.timing(folderIndicator[key], {toValue:bounds[key],duration,easing:Easing.out(Easing.cubic),useNativeDriver:false})));
    animation.start();
    return () => animation.stop();
  }, [filter, folderBounds, folderIndicator, reducedMotion]);
  useEffect(() => {
    folderMotion.setValue(reducedMotion ? 1 : 0);
    const animation = Animated.timing(folderMotion, { toValue: 1, duration: reducedMotion ? 0 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" });
    animation.start();
    return () => animation.stop();
  }, [filter, folderMotion, reducedMotion]);
  const [title, setTitle] = useState(""),
    [roomUsername, setRoomUsername] = useState(""),
    [description, setDescription] = useState(""),
    [visibility, setVisibility] = useState<"public" | "invite">("invite"),
    [info, setInfo] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [keyboardOpen, setKeyboardOpen] = useState(false);
  const closeSearch = useCallback(() => { setSearchOpen(false); setSearch(""); setDebounced(""); Keyboard.dismiss(); }, []);
  useDismissSearch(searchOpen, closeSearch);
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
  const folderWheel = useRef({ amount: 0, last: 0 });
  const pointerSwipe = useRef({ x: 0, y: 0, active: false, suppressUntil: 0 });
  const changeFolder = (direction: number) =>
    setFilter((current) => {
      const folders = ["all", "direct", "group", "channel", "requests"];
      return folders[
        Math.max(0, Math.min(4, folders.indexOf(current) + direction))
      ]!;
    });
  const folderSwipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          !chatOpen && !searchOpen && Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onMoveShouldSetPanResponder: (_, gesture) =>
          !chatOpen &&
          !searchOpen &&
          Math.abs(gesture.dx) > 24 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) > 50) changeFolder(gesture.dx < 0 ? 1 : -1);
        },
      }),
    [chatOpen, searchOpen],
  );
  const wheelProps =
    Platform.OS === "web"
      ? {
          onPointerDown: (event: { nativeEvent: { clientX: number; clientY: number } }) => {
            pointerSwipe.current.x = event.nativeEvent.clientX;
            pointerSwipe.current.y = event.nativeEvent.clientY;
            pointerSwipe.current.active = !chatOpen && !searchOpen;
          },
          onPointerUp: (event: { nativeEvent: { clientX: number; clientY: number }; preventDefault: () => void }) => {
            const swipe = pointerSwipe.current;
            if (!swipe.active) return;
            swipe.active = false;
            const dx = event.nativeEvent.clientX - swipe.x;
            const dy = event.nativeEvent.clientY - swipe.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
              event.preventDefault();
              swipe.suppressUntil = Date.now() + 350;
              changeFolder(dx < 0 ? 1 : -1);
            }
          },
          onClickCapture: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
            if (Date.now() < pointerSwipe.current.suppressUntil) { event.preventDefault(); event.stopPropagation(); }
          },
          onWheel: (event: {
            nativeEvent: { deltaX: number; deltaY: number };
            preventDefault: () => void;
          }) => {
            const { deltaX, deltaY } = event.nativeEvent;
            if (chatOpen || searchOpen || Math.abs(deltaX) <= Math.abs(deltaY))
              return;
            event.preventDefault();
            if (Date.now() - folderWheel.current.last < 450) return;
            folderWheel.current.amount += deltaX;
            if (Math.abs(folderWheel.current.amount) > 55) {
              changeFolder(folderWheel.current.amount > 0 ? 1 : -1);
              folderWheel.current = { amount: 0, last: Date.now() };
            }
          },
        }
      : {};
  const query = useQuery({
    queryKey: ["chat-list", token],
    enabled: Boolean(token),
    queryFn: () => chatApi.list(token!),
    staleTime: 15_000,
    refetchInterval: focused ? 30_000 : false,
  });
  const requestsQuery = useQuery({queryKey: ["chat-friend-requests", token], enabled: Boolean(token), queryFn: () => chatApi.friendRequests(token!), refetchInterval: focused ? 10_000 : false});
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const answerRequest = async (id: string, accept: boolean) => {
    if (!token || requestBusy) return;
    setRequestBusy(id); setError(null);
    try {
      const result = await chatApi.answerFriend(token,id,accept);
      await Promise.all([requestsQuery.refetch(),query.refetch()]);
      if (result.id) { router.push({ pathname: "/messages", params: { chat: result.id } }); setFilter("direct"); }
    } catch (err) {setError(err instanceof Error ? err.message : c.error);}
    finally {setRequestBusy(null);}
  };
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
          Number(Boolean(b.isOfficial)) -
            Number(Boolean(a.isOfficial)) ||
          Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt),
      ),
    [query.data],
  );
  const listedRoom = chats.find((room) => room.id === params.chat);
  // A push can reference a new conversation absent from the restored list.
  // Fetch it now instead of waiting for the list's polling/stale interval.
  const openingChat = useQuery({
    queryKey: ["chat-open", token, params.chat],
    enabled: Boolean(token && focused && params.chat && !listedRoom),
    queryFn: () => chatApi.list(token!),
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });
  useEffect(() => {
    if (openingChat.data) client.setQueryData(["chat-list", token], openingChat.data);
  }, [openingChat.data, client, token]);
  const selected = listedRoom ?? openingChat.data?.chats.find(room => room.id === params.chat);
  const desktopChatMotion = Platform.OS === "web" && isDesktop;
  const [leavingChat, setLeavingChat] = useState<{ room: ChatRoom; search: string } | null>(null);
  const retainedChat = useRef<typeof leavingChat>(null);
  const [exitMotion] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!desktopChatMotion) {
      retainedChat.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clear the retained desktop animation snapshot.
      setLeavingChat(null);
      exitMotion.setValue(1);
      return;
    }
    if (selected) {
      const sameChat = retainedChat.current?.room.id === selected.id;
      retainedChat.current = { room: selected, search: params.messageSearch ?? "" };
      setLeavingChat(retainedChat.current);
      if (!sameChat) { exitMotion.setValue(1); return; }
      const enter = Animated.timing(exitMotion, { toValue: 1, duration: reducedMotion ? 0 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: false });
      enter.start();
      return () => enter.stop();
    }
    if (!retainedChat.current) return;
    const exit = Animated.timing(exitMotion, { toValue: 0, duration: reducedMotion ? 0 : 220, easing: Easing.in(Easing.quad), useNativeDriver: false });
    exit.start(({ finished }) => {
      if (finished) { retainedChat.current = null; setLeavingChat(null); }
    });
    return () => exit.stop();
  }, [desktopChatMotion, selected, params.messageSearch, reducedMotion, exitMotion]);
  const visibleRoom = selected ?? (desktopChatMotion ? leavingChat?.room : undefined);
  const unreadByFolder = useMemo(() => {
    const counts: Record<string, number> = {all: 0, direct: 0, group: 0, channel: 0};
    for (const room of chats) {
      counts.all += room.unread;
      counts[room.kind === "support" ? "direct" : room.kind] += room.unread;
    }
    counts.requests = requestsQuery.data?.requests.length ?? 0;
    return counts;
  }, [chats, requestsQuery.data]);
  const roomTitle = (room: ChatRoom) =>
    room.systemKey === "news"
      ? c.news
      : room.systemKey === "community"
        ? c.community
        : room.kind === "support" && room.isOfficial
          ? c.support
          : room.title;
  const shown = chats.filter(
    (room) =>
      ((searchOpen && Boolean(debounced)) ||
        filter === "all" ||
        (filter === "direct" && ["direct", "support"].includes(room.kind)) ||
        (filter === "group" && room.kind === "group") ||
        (filter === "channel" && room.kind === "channel")) &&
      (!debounced ||
        roomTitle(room).toLowerCase().includes(debounced.toLowerCase())),
  );
  const open = useCallback(
    (id: string, messageSearch = "") => {
      if (Date.now() < pointerSwipe.current.suppressUntil) return;
      router.push({ pathname: "/messages", params: { chat: id, invite: "", messageSearch } });
      setCreating(null);
      setSearch("");
      setDebounced("");
      setSearchOpen(false);
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
      setError(e instanceof ApiError && e.code === "invalid_username" ? c.usernameInvalid : e instanceof ApiError && e.code === "username_taken" ? c.usernameTaken : e instanceof Error ? e.message : c.error);
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
  const profile = useCallback((id: string) => {
    if (Date.now() < pointerSwipe.current.suppressUntil) return;
    setSearch("");
    setDebounced("");
    setSearchOpen(false);
    router.push(playerProfileRoute(id, params.chat, params.messageSearch) as never);
  }, [router, params.chat, params.messageSearch]);
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
      animateEntrance={false}
      contentStyle={{
        flex: 1,
        minHeight: 0,
        paddingTop: isDesktop ? 15 : 0,
        ...(Platform.OS === "web" && isDesktop ? ({
          transitionProperty: "padding-left, padding-bottom",
          transitionDuration: reducedMotion ? "0ms" : "280ms",
          transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        } as unknown as ViewStyle) : {}),
        maxWidth: 1600,
        paddingLeft: isDesktop && !chatOpen ? 150 : 0,
        paddingRight: isDesktop ? 24 : 0,
        paddingBottom: keyboardOpen
          ? 0
          : chatOpen
            ? 0
            : isDesktop
              ? 24
              : 0,
      }}
    >
      <View
        onTouchEnd={Platform.OS !== "web" && searchOpen ? event => {
          const { pageX, pageY } = event.nativeEvent;
          searchBox.current?.measureInWindow((x, y, width, height) => {
            if (pageX < x || pageX > x + width || pageY < y || pageY > y + height) closeSearch();
          });
        } : undefined}
        {...(Platform.OS !== "web" ? folderSwipe.panHandlers : {})}
        {...wheelProps}
        style={[
          styles.shell,
          { backgroundColor: "transparent", borderColor: theme.border },
          isDesktop && styles.desktop,
        ]}
      >
        {isDesktop || (!selected && !chatOpen) ? (
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
                <Avatar userId={user.id} name={user.name} avatarUrl={user.avatarUrl} size={43} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <AppText variant="title">{c.title}</AppText>
                <AppText variant="caption" muted numberOfLines={1}>
                  {user.username ? `@${user.username}` : ""}
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
              onLayout={(event) =>
                setSearchWidth(event.nativeEvent.layout.width - 32)
              }
              style={{ height: 68, flexShrink: 0, marginHorizontal: 0 }}
            >
              <View
                pointerEvents={searchOpen ? "none" : "auto"}
                accessibilityElementsHidden={searchOpen}
                style={[
                  styles.filters,
                  {
                    height: 68,
                    alignItems: "center",
                    opacity: searchOpen ? 0 : 1,
                  },
                ]}
              >
                <Animated.View testID="messages-folder-indicator" pointerEvents="none" style={{position:"absolute",left:0,top:0,borderRadius:14,backgroundColor:theme.primarySoft,
                  width:folderIndicator.width,height:folderIndicator.height,opacity:folderBounds[filter]?1:0,
                  transform:[{translateX:folderIndicator.x},{translateY:folderIndicator.y}]}} />
                {[
                  ["all", c.all],
                  ["direct", c.direct],
                  ["group", c.groups],
                  ["channel", c.channels],
                  ["requests", c.requests],
                ].map(([key, label]) => (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === key }}
                    onPress={() => setFilter(key!)}
                    onLayout={({nativeEvent:{layout}}) => setFolderBounds(current => {
                      const old=current[key!];
                      if(old && old.x===layout.x && old.y===layout.y && old.width===layout.width && old.height===layout.height)return current;
                      return {...current,[key!]:{x:layout.x,y:layout.y,width:layout.width,height:layout.height}};
                    })}
                    style={[
                      styles.filter,
                    ]}
                  >
                    <AppText
                      variant="caption"
                      style={{fontSize:12}}
                      color={String(
                        filter === key ? theme.primary : theme.textMuted,
                      )}
                    >
                      {label}
                    </AppText>
                    {unreadByFolder[key!] > 0 ? <View accessibilityLabel={`${c.unreadMessages}: ${unreadByFolder[key!]}`} style={{minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, marginLeft: 4, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center"}}>
                      <AppText style={{fontSize: 10, lineHeight: 13, color: theme.onPrimary}}>{unreadByFolder[key!] > 99 ? "99+" : unreadByFolder[key!]}</AppText>
                    </View> : null}
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={c.search}
                  onPress={() => setSearchOpen(true)}
                  style={[styles.icon, { marginLeft: "auto" }]}
                >
                  <Ionicons
                    name="search-outline"
                    size={22}
                    color={String(theme.primary)}
                  />
                </Pressable>
              </View>
              <Animated.View
                ref={searchBox}
                nativeID="chat-list-search"
                pointerEvents={searchOpen ? "auto" : "none"}
                style={{
                  position: "absolute",
                  right: 16,
                  top: 12,
                  height: 44,
                  borderRadius: 16,
                  overflow: "hidden",
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: theme.surfaceRaised,
                  opacity: searchMotion,
                  width: searchMotion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [36, Math.max(36, searchWidth)],
                  }),
                }}
              >
                {searchOpen ? (
                  <>
                    <TextInput
                      accessibilityLabel={c.search}
                      autoFocus
                      value={search}
                      onChangeText={setSearch}
                      placeholderTextColor={theme.textMuted}
                      style={{
                        paddingLeft: 14,
                        flex: 1,
                        minWidth: 0,
                        height: 44,
                        color: theme.text,
                        fontSize: 14,
                      }}
                    />
                    <View style={styles.icon}>
                      <Ionicons
                        name="search-outline"
                        size={22}
                        color={String(theme.primary)}
                      />
                    </View>
                  </>
                ) : null}
              </Animated.View>
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
            <Animated.View style={{flex:1,minHeight:0,opacity:folderMotion,transform:[{translateX:folderMotion.interpolate({inputRange:[0,1],outputRange:[14,0]})}]}}>
            {filter === "requests" && !searchOpen ? <View style={{flex:1, paddingHorizontal:16}}>
              {requestsQuery.isPending ? <ActivityIndicator color={String(theme.primary)} /> : null}
              {requestsQuery.isError ? <ChatAction title={c.retry} onPress={()=>void requestsQuery.refetch()} /> : null}
              {error ? <AppText accessibilityRole="alert" color={String(theme.danger)}>{error}</AppText> : null}
              {requestsQuery.data?.requests.length === 0 ? <AppText muted style={{padding:24,textAlign:"center"}}>{c.noRequests}</AppText> : null}
              <FlatList showsVerticalScrollIndicator={false} data={requestsQuery.data?.requests ?? []} keyExtractor={person=>person.id} renderItem={({item:person})=><MotionEntrance style={{paddingVertical:12,gap:10}}>
                <Pressable onPress={()=>profile(person.id)} style={{flexDirection:"row",alignItems:"center",gap:12}}><Avatar userId={person.id} name={person.name} avatarUrl={person.avatarUrl} size={46}/><View style={{flex:1}}><AppText variant="label">{person.name}</AppText>{person.username ? <AppText muted>@{person.username}</AppText>:null}</View></Pressable>
                <View style={{flexDirection:"row",gap:12}}><ChatAction title={c.acceptFriend} icon="checkmark" disabled={Boolean(requestBusy)} onPress={()=>void answerRequest(person.id,true)}/><ChatAction title={c.declineFriend} icon="close" disabled={Boolean(requestBusy)} onPress={()=>void answerRequest(person.id,false)}/></View>
              </MotionEntrance>} />
            </View> : null}
            <FlatList
              style={
                filter === "requests" && !searchOpen ? {display:"none"} : Platform.OS === "web"
                  ? ({
                      maskImage:
                        "linear-gradient(to bottom, transparent 0px, black 24px)",
                      WebkitMaskImage:
                        "linear-gradient(to bottom, transparent 0px, black 24px)",
                    } as ViewStyle)
                  : undefined
              }
              showsVerticalScrollIndicator={false}
              data={filter === "requests" && !searchOpen ? [] : shown}
              keyExtractor={(room) => room.id}
              contentContainerStyle={{
                paddingTop: 12,
                paddingBottom:
                  !isDesktop && !chatOpen ? 128 + insets.bottom : 15,
              }}
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
                  {room.isOfficial ?? Boolean(room.systemKey || (room.kind === "support" && room.isOwner !== true)) ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={roomTitle(room)}
                      onPress={() => open(room.id)}
                    >
                      <LogoMark size={52} />
                    </Pressable>
                  ) : room.peer || room.avatarUrl ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={c.profile}
                      onPress={() =>
                        room.peer ? profile(room.peer.id) : open(room.id)
                      }
                    >
                      <Avatar userId={room.peer?.id ?? room.id}
                        name={room.peer?.username || room.peer?.name || room.title}
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
                      {room.isOfficial ?? Boolean(room.systemKey || (room.kind === "support" && room.isOwner !== true)) ? (
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
                              "en-US",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
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
                    {found.data?.messages?.map((message) => (
                      <ChatAction
                        key={message.id}
                        title={`${chats.find((room) => room.id === message.conversationId)?.title ?? c.search} · ${message.text}`}
                        icon="chatbubble-outline"
                        onPress={() => open(message.conversationId, debounced)}
                      />
                    ))}
                    {found.data?.users.map((person) => (
                      <View key={person.id} style={styles.person}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => profile(person.id)}
                        >
                          <Avatar userId={person.id}
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
                            profile(person.id);
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
                        title={`${room.title}${room.username ? ` · @${room.username}` : ""} · ${c.join}`}
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
            </Animated.View>
          </View>
        ) : null}
        {visibleRoom ? (
          <Animated.View key={visibleRoom.id} testID="chat-exit-transition" pointerEvents={selected ? "auto" : "none"} style={[{ flex: 1, minWidth: 0 }, desktopChatMotion && {
            opacity: exitMotion,
            transform: [{ translateX: exitMotion.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          }]}>
          <ChatTransition testID="chat-conversation-transition" style={{ flex: 1, minWidth: 0 }}>
            <ConversationPane
              room={{ ...visibleRoom, title: roomTitle(visibleRoom) }}
              token={token}
              initialSearch={selected ? params.messageSearch ?? "" : leavingChat?.search ?? ""}
              accountId={user.id ?? ""}
              chats={chats}
              onBack={closeConversation}
              onProfile={profile}
              onInfo={() => setInfo(true)}
            />
          </ChatTransition>
          </Animated.View>
        ) : chatOpen ? (
          <View testID="chat-opening-state" style={[styles.empty, { flex: 1 }]}>
            <ChatAction title={c.close} icon="arrow-back" onPress={closeConversation} />
            {openingChat.isPending || openingChat.isFetching ? (
              <ActivityIndicator color={String(theme.primary)} accessibilityLabel={c.loading} />
            ) : (
              <>
                <AppText>{c.error}</AppText>
                <ChatAction title={c.retry} icon="refresh" onPress={() => { void openingChat.refetch(); }} />
              </>
            )}
          </View>
        ) : isDesktop ? (
          <ChatTransition key="empty-chat" testID="chat-empty-transition" style={styles.empty}>
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
          </ChatTransition>
        ) : null}
      </View>
      {error && !creating ? (
        <Pressable style={{ padding: 10 }} onPress={() => setError(null)}>
          <AppText color={String(theme.danger)}>{error}</AppText>
        </Pressable>
      ) : null}
      {invitingFriends && token ? <InviteFriendsSheet token={token} onClose={()=>setInvitingFriends(false)}/> : null}
      {!user.username && !nicknameDismissed ? <ChatSheet title={c.chooseUsername} onClose={() => setNicknameDismissed(true)}>
          <TextInput accessibilityLabel={c.username} autoCapitalize="none" autoCorrect={false} value={nickname} onChangeText={setNickname} placeholder="@username" style={[styles.input,{color:theme.text,borderColor:theme.border}]} />
          {nicknameError ? <AppText color={String(theme.danger)}>{nicknameError}</AppText> : null}
          <ChatAction title={c.save} icon="checkmark-outline" disabled={savingNickname || !nickname.trim()} onPress={() => { if(!token) return; setSavingNickname(true);setNicknameError(""); void meApi.updateProfile({username:nickname.trim().replace(/^@/,"")},token).then(value=>useAppStore.getState().updateUser(value)).catch(error=>setNicknameError(error instanceof Error ? error.message : String(error))).finally(()=>setSavingNickname(false)); }} />
      </ChatSheet> : null}
      {creating ? (
        <ChatSheet
          title={
            creating === "group"
              ? c.newGroup
              : creating === "channel"
                ? c.newChannel
                : c.newChat
          }
          onClose={() => {setCreating(null);setError(null);}}
        >
          {creating === "menu" ? (
            <>
              <ChatAction title={c.addFriends} icon="person-add-outline" onPress={()=>{setCreating(null);setInvitingFriends(true);}}/>
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
                    profile(person.id);
                  }}
                />
              ))}
            </>
          ) : (
            <>
              <AppText variant="caption" muted>{c.name}</AppText>
              <TextInput
                accessibilityLabel={c.name}
                value={title}
                onChangeText={setTitle}
                placeholder={c.name}
                placeholderTextColor={theme.textMuted}
                maxLength={100}
                style={input}
              />
              <AppText variant="caption" muted>{c.description}</AppText>
              <TextInput
                accessibilityLabel={c.description}
                value={description}
                onChangeText={setDescription}
                placeholder={c.description}
                placeholderTextColor={theme.textMuted}
                maxLength={1000}
                multiline
                style={input}
              />
              <AppText variant="caption" muted>{c.roomUsername}</AppText>
              <TextInput accessibilityLabel={c.roomUsername} placeholder="@username" value={roomUsername} onChangeText={setRoomUsername} autoCapitalize="none" autoCorrect={false} maxLength={25} style={input} />
              <AppText variant="caption" muted>{c.usernameHint}</AppText>
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
                      username: roomUsername,
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
  filters: { flexDirection: "row", gap: 2, padding: 12, paddingHorizontal: 12 },
  filter: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 6, borderRadius: 14 },
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
