import { Pressable, View } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useChatCopy } from "@/lib/chat-copy";
export function VoicePlayer({ url }: { url: string }) {
  const player = useAudioPlayer(url),
    status = useAudioPlayerStatus(player),
    theme = useAppTheme(),
    c = useChatCopy();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={c.voice}
      onPress={() => {
        if (status.playing) player.pause();
        else {
          if (status.didJustFinish) void player.seekTo(0);
          player.play();
        }
      }}
      style={{
        minWidth: 180,
        minHeight: 50,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
      }}
    >
      <Ionicons
        name={status.playing ? "pause-circle" : "play-circle"}
        size={38}
        color={String(theme.primary)}
      />
      <View style={{ flex: 1, gap: 5 }}>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: theme.primarySoft,
          }}
        >
          <View
            style={{
              height: 4,
              borderRadius: 2,
              width: `${Math.min(100, status.duration ? (status.currentTime / status.duration) * 100 : 0)}%`,
              backgroundColor: theme.primary,
            }}
          />
        </View>
        <AppText variant="caption">
          {Math.floor(status.currentTime)} / {Math.floor(status.duration)}s
        </AppText>
      </View>
    </Pressable>
  );
}
