import { memo } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  chatMediaUrl,
  type ChatItem,
  type ChatRoom,
  type ChatFile,
} from "@/lib/chat-api";
import { useChatCopy } from "@/lib/chat-copy";
import { VoicePlayer } from "./voice-player";
export const ChatBubble = memo(function ChatBubble({
  item,
  room,
  onActions,
  onProfile,
  onPhoto,
}: {
  item: ChatItem;
  room: ChatRoom;
  onActions: (item: ChatItem) => void;
  onProfile: (id: string) => void;
  onPhoto: (file: ChatFile) => void;
}) {
  const theme = useAppTheme(),
    c = useChatCopy();
  return (
    <View style={[styles.row, item.own && { justifyContent: "flex-end" }]}>
      {!item.own ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${c.profile}: ${item.sender.name}`}
          onPress={() => onProfile(item.sender.id)}
          style={{ alignSelf: "flex-end" }}
        >
          <Avatar
            name={item.sender.name}
            avatarUrl={item.sender.avatarUrl}
            size={30}
          />
        </Pressable>
      ) : null}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: item.own ? theme.primarySoft : theme.surface,
            borderColor: theme.border,
          },
          item.own && { borderBottomRightRadius: 5 },
        ]}
      >
        {!item.own && ["group", "channel"].includes(room.kind) ? (
          <Pressable onPress={() => onProfile(item.sender.id)}>
            <AppText variant="label" color={String(theme.primary)}>
              {item.sender.name}
            </AppText>
          </Pressable>
        ) : null}
        {item.forwardedFrom ? (
          <AppText variant="caption" color={String(theme.primary)}>
            {c.forwarded} {item.forwardedFrom}
          </AppText>
        ) : null}
        {item.reply ? (
          <View style={[styles.quote, { borderLeftColor: theme.primary }]}>
            <AppText variant="caption" color={String(theme.primary)}>
              {item.reply.sender}
            </AppText>
            <AppText numberOfLines={2} variant="caption" muted>
              {item.reply.text || c.attach}
            </AppText>
          </View>
        ) : null}
        {item.deleted ? (
          <AppText muted>{c.deleted}</AppText>
        ) : (
          <>
            {item.attachments.map((file) =>
              file.kind === "photo" ? (
                <Pressable
                  key={file.id}
                  accessibilityRole="button"
                  accessibilityLabel={c.photo}
                  onPress={() => onPhoto(file)}
                >
                  <Image
                    source={{ uri: chatMediaUrl(file.url) }}
                    resizeMode="cover"
                    style={styles.photo}
                  />
                </Pressable>
              ) : file.kind === "voice" ? (
                <VoicePlayer key={file.id} url={chatMediaUrl(file.url)} />
              ) : (
                <View key={file.id} style={styles.file}>
                  <Ionicons
                    name="document-outline"
                    size={28}
                    color={String(theme.primary)}
                  />
                  <AppText style={{ flex: 1 }} numberOfLines={2}>
                    {file.name}
                  </AppText>
                  <AppText variant="caption" muted>
                    {Math.ceil(file.size / 1024)} KB
                  </AppText>
                </View>
              ),
            )}
            {item.text ? (
              <AppText
                selectable
                onLongPress={() => onActions(item)}
                style={{ lineHeight: 22 }}
              >
                {item.text}
              </AppText>
            ) : null}
          </>
        )}
        {item.reactions.length ? (
          <View style={styles.reactions}>
            {[...new Set(item.reactions.map((r) => r.emoji))].map((emoji) => (
              <View
                key={emoji}
                style={[styles.reaction, { backgroundColor: theme.background }]}
              >
                <AppText>
                  {emoji}{" "}
                  {item.reactions.filter((r) => r.emoji === emoji).length}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.meta}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={c.messageActions}
            onPress={() => onActions(item)}
            style={{
              minWidth: 32,
              minHeight: 30,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={16}
              color={String(theme.textMuted)}
            />
          </Pressable>
          {item.pinned ? (
            <Ionicons name="pin" size={12} color={String(theme.primary)} />
          ) : null}
          {item.edited ? (
            <AppText variant="caption" muted>
              {c.edited}
            </AppText>
          ) : null}
          <AppText variant="caption" muted>
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </AppText>
          {item.own ? (
            <Ionicons
              accessibilityLabel={
                room.peerReadSeq >= item.seq ? c.read : c.sent
              }
              name={
                room.peerReadSeq >= item.seq ? "checkmark-done" : "checkmark"
              }
              size={16}
              color={
                room.peerReadSeq >= item.seq ? theme.primary : theme.textMuted
              }
            />
          ) : null}
        </View>
      </View>
    </View>
  );
});
const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 7, paddingVertical: 5 },
  bubble: {
    maxWidth: "84%",
    minWidth: 80,
    padding: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    gap: 7,
  },
  quote: { borderLeftWidth: 3, paddingLeft: 9, gap: 2 },
  photo: { width: 230, maxWidth: "100%", height: 190, borderRadius: 14 },
  file: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 180,
    maxWidth: 260,
  },
  meta: {
    flexDirection: "row",
    gap: 5,
    alignSelf: "flex-end",
    alignItems: "center",
  },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  reaction: { borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3 },
});
