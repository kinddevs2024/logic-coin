import { pickChatPhoto } from "@/lib/chat-media";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Pressable,
  Share,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { AppText } from "@/components/app-text";
import { LogoMark } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { chatApi, chatMediaUrl, type ChatRoom } from "@/lib/chat-api";
import { useChatCopy } from "@/lib/chat-copy";
import { MIGRATED_APP_ORIGIN } from "@/lib/server-migration";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MotionPressable } from "@/components/motion-pressable";
import { ChatAction, ChatSheet } from "./chat-sheet";
export function ChatRoomInfo({
  room,
  token,
  accountId,
  onClose,
  onLeave,
}: {
  room: ChatRoom;
  token: string;
  accountId: string;
  onClose: () => void;
  onLeave: () => void;
}) {
  const theme = useAppTheme();
  const [title, setTitle] = useState(room.title),
    [description, setDescription] = useState(room.description);
  const [username, setUsername] = useState(room.username ?? "");
  const [visibility, setVisibility] = useState(room.visibility ?? "invite");
  const c = useChatCopy(),
    router = useRouter(),
    client = useQueryClient();
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["chat-members", token, room.id],
    queryFn: () => chatApi.members(token, room.id),
    staleTime: 10_000,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false),
    [addSearch, setAddSearch] = useState(""),
    [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(addSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [addSearch]);
  const candidates = useQuery({
    queryKey: ["chat-invite-search", token, room.id, search],
    queryFn: () => chatApi.friends(token, search),
    enabled: addOpen,
    staleTime: 10000,
  });
  const selected = query.data?.members.find((p) => p.id === selectedId);
  const canManageMembers =
    room.canManage &&
    !room.systemKey &&
    ["group", "channel"].includes(room.kind);
  const people =
    candidates.data?.users.filter(
      (p) =>
        p.id !== accountId && !query.data?.members.some((m) => m.id === p.id),
    ) ?? [];
  const roleLabel = (role: string) =>
    role === "owner" ? c.owner : role === "admin" ? c.admin : c.member;
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await Promise.all([
        client.invalidateQueries({ queryKey: ["chat-list", token] }),
        query.refetch(),
      ]);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : c.error);
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (selected)
    return (
      <ChatSheet
        title={`${c.memberSettings} · ${selected.name}`}
        onClose={onClose}
      >
        <View style={{ alignItems: "center", gap: 8, paddingBottom: 12 }}>
          <Avatar userId={selected.id}
            name={selected.name}
            avatarUrl={selected.avatarUrl}
            size={70}
          />
          <AppText variant="heading">{selected.name}</AppText>
          <AppText muted>
            {selected.username ? `@${selected.username} · ` : ""}
            {roleLabel(selected.role)}
          </AppText>
        </View>
        <ChatAction
          title={c.members}
          icon="chevron-back"
          onPress={() => {
            setSelectedId(null);
            setError(null);
          }}
        />
        {room.canPromote ? (
          <ChatAction
            title={selected.role === "admin" ? c.makeMember : c.makeAdmin}
            disabled={busy}
            icon="shield-checkmark-outline"
            onPress={() => {
              void run(() =>
                chatApi.member(token, room.id, {
                  targetId: selected.id,
                  role: selected.role === "admin" ? "member" : "admin",
                }),
              );
            }}
          />
        ) : null}
        {room.canPromote && selected.role === "member" ? (
          <ChatAction
            title={selected.canEditInfo ? c.revokeInfo : c.allowInfo}
            disabled={busy}
            icon="create-outline"
            onPress={() => {
              void run(() =>
                chatApi.member(token, room.id, {
                  targetId: selected.id,
                  canEditInfo: !selected.canEditInfo,
                }),
              );
            }}
          />
        ) : null}
        <ChatAction
          title={`${c.removeMember} · ${selected.name}`}
          danger
          disabled={busy}
          icon="person-remove-outline"
          onPress={() => {
            void (async () => {
              if (
                await run(() =>
                  chatApi.member(token, room.id, {
                    targetId: selected.id,
                    remove: true,
                  }),
                )
              )
                setSelectedId(null);
            })();
          }}
        />
        {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
      </ChatSheet>
    );
  return (
    <ChatSheet title={room.title} onClose={onClose}>
      <View style={{ alignItems: "center", gap: 8, paddingBottom: 14 }}>
        {room.username ? <AppText muted>@{room.username}</AppText> : null}
        {room.isOfficial ?? Boolean(room.systemKey || (room.kind === "support" && !room.isOwner)) ? <LogoMark size={86} /> : (
        <Avatar userId={room.peer?.id ?? room.id}
          name={room.title}
          avatarUrl={room.avatarUrl ? chatMediaUrl(room.avatarUrl) : null}
          size={86}
        />
        )}
        {!room.canManage && room.description ? (
          <AppText muted>{room.description}</AppText>
        ) : null}
      </View>
      {(room.canEditInfo ?? room.canManage) &&
      ["group", "channel"].includes(room.kind) ? (
        <View style={{ gap: 8 }}>
          <AppText variant="label">{c.settings}</AppText>
          {room.canManage ? <>
            <TextInput accessibilityLabel={c.roomUsername} placeholder={c.roomUsername} value={username} onChangeText={setUsername} autoCapitalize="none" maxLength={25} style={{ padding: 12, borderRadius: 15, color: theme.text, backgroundColor: theme.surfaceRaised }} />
            <ChatAction title={`${visibility === "public" ? "●" : "○"} ${c.publicRoom}`} onPress={() => setVisibility("public")} />
            <ChatAction title={`${visibility === "invite" ? "●" : "○"} ${c.privateRoom}`} onPress={() => setVisibility("invite")} />
          </> : null}
          <AppText variant="caption" muted>
            {c.name}
          </AppText>
          <TextInput
            accessibilityLabel={c.name}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            style={{
              padding: 12,
              borderRadius: 15,
              color: theme.text,
              backgroundColor: theme.surfaceRaised,
            }}
          />
          <AppText variant="caption" muted>
            {c.description}
          </AppText>
          <TextInput
            accessibilityLabel={c.description}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={1000}
            style={{
              padding: 12,
              borderRadius: 15,
              color: theme.text,
              backgroundColor: theme.surfaceRaised,
            }}
          />
          <ChatAction
            title={c.save}
            disabled={busy || !title.trim()}
            icon="checkmark"
            onPress={() => {
              void run(() =>
                chatApi.updateRoom(token, room.id, {
                  title: title.trim(),
                  description,
                  ...(room.canManage ? { username, visibility } : {}),
                }),
              );
            }}
          />
          <ChatAction
            title={c.photo}
            icon="camera-outline"
            disabled={busy}
            onPress={() => {
              void run(async () => {
                const file = await pickChatPhoto();
                if (file) {
                  const saved = await chatApi.upload(token, file);
                  await chatApi.updateRoom(token, room.id, {
                    title: title.trim(),
                    description,
                    avatarAttachmentId: saved.id,
                  });
                }
              });
            }}
          />
        </View>
      ) : room.description ? (
        <AppText muted>{room.description}</AppText>
      ) : null}
      <ChatAction
        title={room.muted ? c.unmute : c.mute}
        icon={
          room.muted ? "notifications-outline" : "notifications-off-outline"
        }
        disabled={busy}
        onPress={() => {
          void run(() =>
            chatApi.member(token, room.id, { muted: !room.muted }),
          );
        }}
      />
      <ChatAction
        title={room.pinned ? c.unpin : c.pin}
        icon="pin-outline"
        disabled={busy}
        onPress={() => {
          void run(() =>
            chatApi.member(token, room.id, { pinned: !room.pinned }),
          );
        }}
      />
      {room.inviteCode && room.visibility === "public" ? (
        <ChatAction
          title={c.invite}
          icon="link-outline"
          onPress={() => {
            void Share.share({
              message: `${room.title}\n${MIGRATED_APP_ORIGIN}/messages?invite=${room.inviteCode}`,
            }).catch(() => setError(c.error));
          }}
        />
      ) : null}
      {room.peer ? (
        <ChatAction
          title={c.profile}
          icon="person-outline"
          onPress={() => {
            onClose();
            router.push(`/player/${room.peer!.id}` as never);
          }}
        />
      ) : null}
      <AppText variant="heading">
        {c.members} · {query.data?.count ?? "…"}
      </AppText>
      {query.data?.members.map((person) => (
        <View
          key={person.id}
          style={{
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            paddingVertical: 8,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${c.profile}: ${person.name}`}
            onPress={() => {
              onClose();
              router.push(`/player/${person.id}` as never);
            }}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Avatar userId={person.id} name={person.name} avatarUrl={person.avatarUrl} size={42} />
            <View style={{ flex: 1 }}>
              <AppText variant="label">{person.name}</AppText>
              <AppText variant="caption" muted>
                {person.username ? `@${person.username} · ` : ""}
                {roleLabel(person.role)}
              </AppText>
              {person.canEditInfo && person.role === "member" ? (
                <AppText variant="caption" muted>
                  {c.infoPermission}
                </AppText>
              ) : null}
            </View>
          </Pressable>
          {canManageMembers &&
          person.id !== accountId &&
          person.role !== "owner" &&
          (room.canPromote || person.role !== "admin") ? (
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={`${c.memberSettings}: ${person.name}`}
              onPress={() => {
                setSelectedId(person.id);
                setError(null);
              }}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 22,
                backgroundColor: theme.primarySoft,
              }}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={23}
                color={String(theme.primary)}
              />
            </MotionPressable>
          ) : null}
        </View>
      ))}
      {canManageMembers ? (
        <>
          <ChatAction
            title={c.addMembers}
            icon="person-add-outline"
            onPress={() => {
              setAddOpen(!addOpen);
              setError(null);
            }}
          />
          {addOpen ? (
            <View style={{ gap: 10, paddingTop: 4 }}>
              <TextInput
                accessibilityLabel={c.searchMembers}
                placeholder={c.searchMembers}
                placeholderTextColor={String(theme.textMuted)}
                value={addSearch}
                onChangeText={setAddSearch}
                autoFocus
                style={{
                  padding: 12,
                  minHeight: 46,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceRaised,
                  color: theme.text,
                }}
              />
              {candidates.isPending ? (
                <ActivityIndicator color={String(theme.primary)} />
              ) : null}
              {!candidates.isPending &&
              !candidates.isError &&
              !people.length ? (
                <AppText muted>{c.noPeople}</AppText>
              ) : null}
              {candidates.isError ? (
                <ChatAction
                  title={c.retry}
                  onPress={() => void candidates.refetch()}
                />
              ) : null}
              {true
                ? people.map((person) => (
                    <View
                      key={person.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 9,
                      }}
                    >
                      <Avatar userId={person.id}
                        name={person.name}
                        avatarUrl={person.avatarUrl}
                        size={36}
                      />
                      <View style={{ flex: 1 }}>
                        <AppText variant="label">{person.name}</AppText>
                        {person.username ? (
                          <AppText variant="caption" muted>
                            @{person.username}
                          </AppText>
                        ) : null}
                      </View>
                      <ChatAction
                        title={c.add}
                        icon="add"
                        disabled={busy}
                        onPress={() => {
                          void run(() =>
                            chatApi.addMember(token, room.id, person.id),
                          );
                        }}
                      />
                    </View>
                  ))
                : null}
            </View>
          ) : null}
        </>
      ) : null}
      {!room.systemKey &&
      !room.isOwner &&
      ["group", "channel"].includes(room.kind) ? (
        <ChatAction
          title={c.leave}
          danger
          icon="exit-outline"
          disabled={busy}
          onPress={() => {
            void run(async () => {
              await chatApi.member(token, room.id, { leave: true });
              onClose();
              onLeave();
            });
          }}
        />
      ) : null}
      {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
    </ChatSheet>
  );
}
