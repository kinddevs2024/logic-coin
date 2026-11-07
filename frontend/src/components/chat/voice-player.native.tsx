import type { ComponentProps } from "react";
import { Linking, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "@/components/app-text";
import { loadChatAudio } from "@/lib/native-chat-audio";
import { useChatCopy } from "@/lib/chat-copy";
import { useAppTheme } from "@/hooks/use-app-theme";
type Props = ComponentProps<typeof import("./voice-player-implementation").VoicePlayer>;
const player = loadChatAudio(() => require("./voice-player-implementation") as typeof import("./voice-player-implementation"));
export function VoicePlayer(props: Props) {
  const c = useChatCopy(), theme = useAppTheme();
  if (player) return <player.VoicePlayer {...props} />;
  return <Pressable accessibilityRole="button" accessibilityLabel={c.voice} onPress={event => {event.stopPropagation();void Linking.openURL(props.url).catch(() => {});}} style={{minWidth:180,minHeight:60,flexDirection:"row",gap:12,alignItems:"center"}}>
    <Ionicons name="play-circle" size={44} color={String(theme.primary)} />
    <View><AppText>{c.voice}</AppText><AppText muted variant="caption">{c.openVoice}</AppText></View>
  </Pressable>;
}
