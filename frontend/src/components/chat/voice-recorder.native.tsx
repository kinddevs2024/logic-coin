import type { ComponentProps } from "react";
import { Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { loadChatAudio } from "@/lib/native-chat-audio";
import { useChatCopy } from "@/lib/chat-copy";
import { useAppTheme } from "@/hooks/use-app-theme";
type Props = ComponentProps<typeof import("./voice-recorder-implementation").VoiceRecorder>;
// Do not import the implementation until native module availability is known.
const recorder = loadChatAudio(() => require("./voice-recorder-implementation") as typeof import("./voice-recorder-implementation"));
export function VoiceRecorder(props: Props) {
  const c = useChatCopy(), theme = useAppTheme();
  if (recorder) return <recorder.VoiceRecorder {...props} />;
  return <Pressable accessibilityRole="button" accessibilityLabel={c.voice} onPress={() => props.onError(new Error(c.audioUpdateRequired))} style={{width:42,height:42,alignItems:"center",justifyContent:"center"}}>
    <Ionicons name="mic-outline" size={23} color={String(theme.primary)} />
  </Pressable>;
}
