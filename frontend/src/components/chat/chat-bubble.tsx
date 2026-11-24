import { MessagePressable } from "./message-pressable";
import { SystemMessageReactions } from "./system-message-reactions";
import { RaffleWinnerSystemMessage } from "./raffle-winner-system-message";
import { WithdrawalSystemMessage } from "./withdrawal-system-message";
import { VideoPlayer } from "./video-player";
import { isChatVideo } from "@/lib/chat-video";
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion, ZoomIn, ZoomOut } from "react-native-reanimated";

import { memo } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "@/components/app-text";
import { LogoMark } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  chatMediaUrl,
  type ChatItem,
  type ChatRoom,
  type ChatFile,
} from "@/lib/chat-api";
import { useChatCopy } from "@/lib/chat-copy";
import { useAppStore } from "@/store/app-store";
import { splitChatLinks } from "@/lib/chat-links";
import { ChatPhoto } from "./chat-photo";
import { VoicePlayer } from "./voice-player";
import type { ChatAnchor } from "./chat-popover";
const reactionLayout = LinearTransition.duration(220).reduceMotion(ReduceMotion.System);
const reactionEntering = FadeIn.duration(180).reduceMotion(ReduceMotion.System);
const reactionExiting = FadeOut.duration(140).reduceMotion(ReduceMotion.System);
const checkEntering = ZoomIn.duration(140).withInitialValues({ transform: [{ scale: 0.66 }] }).reduceMotion(ReduceMotion.System);
const checkExiting = ZoomOut.duration(110).reduceMotion(ReduceMotion.System);


export const ChatBubble = memo(function ChatBubble({
  item,
  room,
  onActions,
  onSelect,
  selecting = false,
  selected = false,
  onProfile,
  onPhoto,
  onListened,
  onReplyPress,
  onComments,
  onViewers,
  onVote,
  highlighted,
  showAvatar = true,
}: {
  item: ChatItem;
  room: ChatRoom;
  onActions: (item: ChatItem, anchor?: ChatAnchor) => void;
  onSelect: (item: ChatItem) => void;
  selecting?: boolean;
  selected?: boolean;
  onProfile: (id: string) => void;
  onPhoto: (file: ChatFile) => void;
  onReplyPress?: (id: string) => void;
  onComments?: () => void;
  onViewers?: () => void;
  onVote?: (option:number) => void;
  highlighted?: boolean;
  showAvatar?: boolean;
  onListened?: (item: ChatItem) => void;
}) {
  const theme = useAppTheme(),
    c = useChatCopy();
  const timeFormat = useAppStore(state => state.timeFormat);
  if (item.system && !item.deleted) return (
    <MessagePressable
      nativeID={`chat-seq-${item.seq}`}
      accessibilityRole="button"
      accessibilityLabel={c.messageActions}
      accessibilityState={selecting ? { selected } : undefined}
      onActions={anchor => onActions(item, anchor)}
      onSelect={() => onSelect(item)}
      style={{ width: "100%", borderRadius: 16, backgroundColor: highlighted ? theme.primarySoft : undefined }}
    >
      <View pointerEvents={selecting ? "none" : "auto"}>
        {item.system.kind === "raffle_winner"
          ? <RaffleWinnerSystemMessage event={item.system} createdAt={item.createdAt} onProfile={onProfile} />
          : <WithdrawalSystemMessage event={item.system} createdAt={item.createdAt} onProfile={onProfile} />}
        <SystemMessageReactions item={item} onActions={onActions} />
      </View>
      {selected ? <Animated.View pointerEvents="none" entering={checkEntering} exiting={checkExiting} style={styles.selectionMark}><Ionicons name="checkmark-circle" size={21} color={String(theme.primary)} /></Animated.View> : null}
    </MessagePressable>
  );
  const hasVoice = !item.deleted && item.attachments.some(file => file.kind === "voice");
  const voiceOnly = hasVoice && item.attachments.length === 1 && !item.text;
  const inlineTime = Boolean(item.text) && !item.pending && !item.deleted && !item.attachments.length && !item.reactions.length && !item.edited && !item.pinned && item.viewCount === undefined;
  const time = new Date(item.createdAt).toLocaleTimeString(timeFormat === "24" ? "en-GB" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: timeFormat !== "24" }).replace(/\s/g, "\u00a0");
  return (
    <Animated.View entering={reactionEntering} layout={reactionLayout}
      style={[styles.row, highlighted && { backgroundColor: theme.primarySoft, borderRadius: 16 }, item.own && { justifyContent: "flex-end" }]}
    >
      {!item.own && !showAvatar ? <View style={{width: 30}} /> : null}
      {!item.own && showAvatar ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${c.profile}: ${item.sender.name}`}
          disabled={selecting || item.sender.isSupportTeam}
          onPress={(event) => {
            event.stopPropagation();
            onProfile(item.sender.id);
          }}
          style={{ alignSelf: "flex-end" }}
        >
          <>{item.sender.isSupportTeam ? <LogoMark size={30} /> : <Avatar userId={item.sender.id}
            name={item.sender.name}
            avatarUrl={item.sender.avatarUrl}
            size={30}
          />}</>
        </Pressable>
      ) : null}
      <MessagePressable
        nativeID={`chat-seq-${item.seq}`}
        accessibilityRole="button"
        accessibilityLabel={c.messageActions}
        accessibilityState={selecting ? { selected } : undefined}
        onActions={anchor => onActions(item, anchor)}
        onSelect={() => onSelect(item)}
        style={[
          styles.bubble,
          {
            backgroundColor: item.own ? theme.primarySoft : theme.surface,
            borderColor: theme.border,
          },
          {
            borderBottomLeftRadius: item.own ? 20 : 5,
            borderBottomRightRadius: item.own ? 5 : 20,
          },
        ]}
      >
        <View style={styles.bubbleContent} pointerEvents={selecting ? "none" : "auto"}>
        {!item.own && (["group", "channel"].includes(room.kind) || item.sender.isSupportTeam) ? (
          <Pressable disabled={item.sender.isSupportTeam}
            onPress={(event) => {
              event.stopPropagation();
              onProfile(item.sender.id);
            }}
          >
            <AppText variant="label" color={String(theme.primary)} style={{lineHeight:17, fontSize:13}}>
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
          <Pressable accessibilityRole="button" accessibilityLabel={c.viewOriginal} onPress={event=>{event.stopPropagation();onReplyPress?.(item.reply!.id);}} style={[styles.quote, { borderLeftColor: theme.primary, backgroundColor: theme.primarySoft }]}>
            <AppText variant="caption" color={String(theme.primary)}>
              {item.reply.sender}
            </AppText>
            <AppText numberOfLines={2} variant="caption" muted>
              {item.reply.text || c.attach}
            </AppText>
          </Pressable>
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
                  onPress={(event) => {
                    event.stopPropagation();
                    onPhoto(file);
                  }}
                >
                  <ChatPhoto uri={chatMediaUrl(file.url)} />
                </Pressable>
              ) : file.kind === "voice" ? (
                <VoicePlayer key={file.id} url={chatMediaUrl(file.url)} unread={!item.own && !item.voiceListened} onListened={() => onListened?.(item)} />
              ) : isChatVideo(file) ? (
                <VideoPlayer key={file.id} url={chatMediaUrl(file.url)} name={file.name} />
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
                color={String(theme.text)}
                selectable
                style={{ lineHeight: 22, flexShrink: 1, maxWidth: "100%" }}
              >
                {splitChatLinks(item.text).map((part, index) => part.url ? <AppText key={index} accessibilityRole="link" color={String(theme.primary)} style={{textDecorationLine:"underline"}} onPress={event => {event.stopPropagation();const link=new URL(part.url!);const profile=/^\/player\/([a-f\d]{24})\/?$/i.exec(link.pathname);if(profile && ["logic-coin.online","www.logic-coin.online"].includes(link.hostname))onProfile(profile[1]!);else void Linking.openURL(part.url!).catch(() => {});}}>{part.text}</AppText> : part.text)}
                {inlineTime ? <AppText variant="caption" color={String(theme.textMuted)} style={{fontSize:11,lineHeight:16}}>
                  {"   "}{time}{item.own ? "\u00a0" : ""}{item.own ? <Ionicons accessibilityLabel={room.peerReadSeq >= item.seq ? c.read : c.sent} name={room.peerReadSeq >= item.seq ? "checkmark-done" : "checkmark"} size={13} color={room.peerReadSeq >= item.seq ? theme.primary : theme.textMuted} /> : null}
                </AppText> : null}
              </AppText>
            ) : null}
            {item.poll ? <View style={{gap:6,minWidth:180,marginTop:6}}>{item.poll.options.map((option,index) => <Pressable key={index} accessibilityRole="button" accessibilityState={{selected:item.poll?.myVote === index}} onPress={event => {event.stopPropagation();onVote?.(index);}} style={{borderWidth:1,borderColor:item.poll?.myVote === index ? theme.primary : theme.border,borderRadius:12,padding:8,flexDirection:"row",alignItems:"center",gap:8}}><Ionicons name={item.poll?.myVote === index ? "radio-button-on" : "radio-button-off"} size={17} color={String(theme.primary)}/><AppText style={{flex:1}}>{option.text}</AppText><AppText variant="caption" muted>{option.votes}</AppText></Pressable>)}</View> : null}
          </>
        )}
        {!inlineTime ? <View style={[styles.footer, voiceOnly && !item.reactions.length && { position: "absolute", right: 10, bottom: 7 }]}>
        {item.reactions.length ? (
          <View style={styles.reactions}>
            {[...new Set(item.reactions.map((r) => r.emoji))].map((emoji) => {
              const reactions = item.reactions.filter(r => r.emoji === emoji);
              const people = reactions.filter(r => r.user).slice(0, 3);
              return (
              <Animated.View entering={reactionEntering} exiting={reactionExiting} layout={reactionLayout}
                key={emoji}
                style={[styles.reaction, { backgroundColor: theme.background }]}
              >
                <AppText style={{fontSize: 16, lineHeight: 21}}>{emoji}</AppText>
                {people.length ? <View style={{flexDirection: "row", paddingLeft: 3}}>
                  {people.map((reaction, index) => <View key={reaction.userId} style={{marginLeft: index ? -5 : 0, borderRadius: 12, borderWidth: 1, borderColor: theme.background}}>
                    <Avatar userId={reaction.userId} name={reaction.user!.name} avatarUrl={reaction.user!.avatarUrl} size={20} />
                  </View>)}
                </View> : null}
                {reactions.length > people.length ? <AppText variant="caption">{people.length ? `+${reactions.length - people.length}` : reactions.length}</AppText> : null}
              </Animated.View>
            ); })}
          </View>
        ) : null}
        <View style={styles.meta}>
          {item.viewCount !== undefined ? <Pressable disabled={!onViewers} accessibilityRole="button" accessibilityLabel={`${item.viewCount}`} onPress={event => {event.stopPropagation(); onViewers?.();}} style={{flexDirection:"row",alignItems:"center",gap:3}}><Ionicons name="eye-outline" size={13} color={String(theme.textMuted)}/><AppText variant="caption" muted>{item.viewCount}</AppText></Pressable> : null}
          {item.pinned ? (
            <Ionicons name="pin" size={12} color={String(theme.primary)} />
          ) : null}
          {item.edited ? (
            <AppText variant="caption" muted>
              {c.edited}
            </AppText>
          ) : null}
          <AppText variant="caption" color={String(theme.textMuted)}>
            {time}
          </AppText>
          {item.pending ? <Ionicons accessibilityLabel={c.pending} name="time-outline" size={15} color={String(theme.textMuted)}/> : item.own ? (
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
        </View> : null}
        {room.kind === "channel" && !item.deleted && onComments ? <Pressable accessibilityRole="button" accessibilityLabel={`${c.comments}: ${item.commentCount ?? 0}`} onPress={event => { event.stopPropagation(); onComments(); }} style={{borderTopWidth:1,borderTopColor:theme.border,marginTop:5,paddingTop:8,paddingBottom:3,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6}}><Ionicons name="chatbubble-outline" size={15} color={String(theme.primary)}/><AppText variant="caption" color={String(theme.primary)}>{c.comments} · {item.commentCount ?? 0}</AppText></Pressable> : null}
        </View>
        {selected ? <Animated.View pointerEvents="none" entering={checkEntering} exiting={checkExiting} style={styles.selectionMark}><Ionicons name="checkmark-circle" size={18} color={String(theme.primary)} /></Animated.View> : null}
      </MessagePressable>
    </Animated.View>
  );
});
const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 7, paddingVertical: 3 },
  bubble: {
    maxWidth: "84%",
    minWidth: 80,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  bubbleContent: { gap: 3 },
  selectionMark: { position: "absolute", top: 3, right: -7 },
  quote: { borderLeftWidth: 3, borderRadius: 6, overflow: "hidden", paddingLeft: 9, paddingRight: 8, paddingVertical: 5, gap: 2 },
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
    marginLeft: "auto",
  },
  footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", columnGap: 8, rowGap: 4 },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: 5, flexShrink: 1 },
  reaction: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 14, paddingHorizontal: 5, paddingVertical: 2 },
});
