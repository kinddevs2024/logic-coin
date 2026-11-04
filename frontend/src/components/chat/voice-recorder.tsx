import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useChatCopy } from "@/lib/chat-copy";
import { readChatFile } from "@/lib/chat-media";
import type { ChatDraftFile } from "@/lib/chat-api";
export function VoiceRecorder({
  onFile,
  onError,
}: {
  onFile: (file: ChatDraftFile) => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const c = useChatCopy(),
    theme = useAppTheme();
  const busyRef = useRef(false),
    finishRef = useRef<() => Promise<void>>(async () => {});
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (event) => {
    if (event.isFinished && !busyRef.current) void finishRef.current();
  });
  const status = useAudioRecorderState(recorder, 250);
  const [busy, setBusy] = useState(false),
    [retryClip, setRetryClip] = useState<ChatDraftFile | null>(null);
  const finish = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let clip = retryClip;
    try {
      if (recorder.isRecording) await recorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      if (!clip && recorder.uri)
        clip = await readChatFile(
          recorder.uri,
          Platform.OS === "web" ? "voice.webm" : "voice.m4a",
          Platform.OS === "web" ? "audio/webm" : "audio/mp4",
          "voice",
        );
      if (clip) {
        await onFile(clip);
        setRetryClip(null);
      }
    } catch (error) {
      if (clip) setRetryClip(clip);
      onError(error);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    finishRef.current = finish;
  });
  const press = async () => {
    if (busyRef.current) return;
    if (status.isRecording || retryClip) {
      await finish();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error(c.permission);
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: 120 });
    } catch (error) {
      onError(error);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {status.isRecording ? (
        <AppText style={{ color: theme.danger }}>
          {Math.floor(status.durationMillis / 1000)}s
        </AppText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          retryClip ? c.retry : status.isRecording ? c.stop : c.voice
        }
        onPress={() => {
          void press();
        }}
        disabled={busy}
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: status.isRecording
            ? theme.primarySoft
            : "transparent",
        }}
      >
        {busy ? (
          <ActivityIndicator color={String(theme.primary)} />
        ) : (
          <Ionicons
            name={
              retryClip
                ? "refresh"
                : status.isRecording
                  ? "stop-circle"
                  : "mic-outline"
            }
            size={23}
            color={status.isRecording ? theme.danger : theme.primary}
          />
        )}
      </Pressable>
    </View>
  );
}
