import { useVoiceWaveform } from "./use-voice-waveform";
import { Animated, Pressable, View } from "react-native";
import { useEffect, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppText } from "@/components/app-text";
import { useChatCopy } from "@/lib/chat-copy";
import { useAppTheme } from "@/hooks/use-app-theme";
export function VoicePlayer({ url, unread = false, onListened }: { url: string; unread?: boolean; onListened?: () => void }) {
  const player = useAudioPlayer(url, { updateInterval: 50 }),
    status = useAudioPlayerStatus(player),
    c = useChatCopy();
  const bars = useVoiceWaveform(url);
  const theme = useAppTheme();
  const [started, setStarted] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let frame = 0;
    const update = () => {
      progress.setValue(status.duration ? Math.min(1, player.currentTime / status.duration) : 0);
      if (status.playing) frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [player, progress, status.duration, status.playing, status.currentTime]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={c.voice}
      onPress={(event) => {
        event.stopPropagation();
        if (status.playing) player.pause();
        else {
          setStarted(true);
          onListened?.();
          if (status.didJustFinish) void player.seekTo(0);
          player.play();
        }
      }}
      style={{
        width: 240,
        maxWidth: "100%",
        minHeight: 61,
        flexDirection: "row",
        gap: 9,
        alignItems: "center",
      }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={status.playing ? "pause" : "play"} size={27} color={String(theme.onPrimary)} style={{ marginLeft: status.playing ? 0 : 3 }} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <View
          style={{
            height: 30,
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            overflow: "hidden",
          }}
        >
          {bars.map((height, index) => (
            <Animated.View
              key={index}
              style={{
                flex: 1,
                minWidth: 2,
                height: 4 + height * 24,
                borderRadius: 2,
                backgroundColor: theme.primary,
                opacity: progress.interpolate({
                  inputRange: [index / bars.length, (index + 1) / bars.length],
                  outputRange: [0.35, 1],
                  extrapolate: "clamp",
                }),
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <AppText variant="caption">
          {formatVoiceTime(
            status.playing || (status.currentTime > 0 && !status.didJustFinish)
              ? status.currentTime
              : status.duration,
          )}
        </AppText>
        {unread && !started ? <View accessibilityLabel={c.unplayedVoice} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: theme.primary }} /> : null}
        </View>
      </View>
    </Pressable>
  );
}
function formatVoiceTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
}
