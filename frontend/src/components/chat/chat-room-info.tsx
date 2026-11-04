import { pickChatPhoto } from "@/lib/chat-media";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Share, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { chatApi, type ChatRoom } from "@/lib/chat-api";
import { useChatCopy } from "@/lib/chat-copy";
import { MIGRATED_APP_ORIGIN } from "@/lib/server-migration";
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
    } catch (e) {
      setError(e instanceof Error ? e.message : c.error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ChatSheet title={room.title} onClose={onClose}>
      {room.canManage && ["group", "channel"].includes(room.kind) ? (
        <View style={{ gap: 8 }}>
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
      {room.inviteCode ? (
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
        <View key={person.id} style={{ gap: 3, paddingVertical: 7 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onClose();
              router.push(`/player/${person.id}` as never);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <Avatar name={person.name} avatarUrl={person.avatarUrl} size={38} />
            <View style={{ flex: 1 }}>
              <AppText variant="label">{person.name}</AppText>
              <AppText variant="caption" muted>
                {person.username ? `@${person.username}` : person.role}
              </AppText>
            </View>
          </Pressable>
          {room.canManage &&
          !room.systemKey &&
          ["group", "channel"].includes(room.kind) &&
          person.id !== accountId &&
          person.role !== "owner" ? (
            <View style={{ paddingLeft: 35 }}>
              {room.canPromote ? (
                <ChatAction
                  title={person.role === "admin" ? c.makeMember : c.makeAdmin}
                  disabled={busy}
                  onPress={() => {
                    void run(() =>
                      chatApi.member(token, room.id, {
                        targetId: person.id,
                        role: person.role === "admin" ? "member" : "admin",
                      }),
                    );
                  }}
                />
              ) : null}
              <ChatAction
                title={c.removeMember}
                danger
                disabled={busy}
                onPress={() => {
                  void run(() =>
                    chatApi.member(token, room.id, {
                      targetId: person.id,
                      remove: true,
                    }),
                  );
                }}
              />
            </View>
          ) : null}
        </View>
      ))}
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
