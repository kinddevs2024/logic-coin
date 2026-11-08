import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  FadeInRight, FadeOutRight, LinearTransition, ZoomIn, ZoomOut,
  useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from "react-native-reanimated";
import {
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useChatCopy } from "@/lib/chat-copy";
import { readChatFile } from "@/lib/chat-media";
import type { ChatDraftFile } from "@/lib/chat-api";
export function VoiceRecorder({
  onFile,
  onError,
  onActiveChange,
}: {
  onFile: (file: ChatDraftFile) => Promise<void>;
  onError: (error: unknown) => void;
  onActiveChange: (active: boolean) => void;
}) {
  const c = useChatCopy(),
    theme = useAppTheme();
  const reducedMotion = useReducedMotion();
  const sending = useSharedValue(0);
  const sendingStyle = useAnimatedStyle(() => ({
    opacity: 1 - sending.value,
    transform: [{ translateY: -18 * sending.value }, { scale: 1 - 0.04 * sending.value }],
  }));
  const busyRef = useRef(false),
    finishRef = useRef<() => Promise<void>>(async () => {});
  const recorder = useAudioRecorder(
    { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true },
    (event) => {
      if (event.isFinished && !busyRef.current) void finishRef.current();
    },
  );
  const status = useAudioRecorderState(recorder, 100);
  const [waveWidth, setWaveWidth] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array(256).fill(4));
  useEffect(() => {
    if (!status.isRecording) return;
    const timer = setInterval(() => {
      const db = recorder.getStatus().metering ?? -60;
      const height = Math.max(4, Math.min(26, 4 + Math.pow(10, db / 40) * 28));
      setLevels(previous => [...previous.slice(1), height]);
    }, 100);
    return () => clearInterval(timer);
  }, [status.isRecording, recorder]);
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
        setRetryClip(clip);
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
    if (retryClip) {
      busyRef.current = true;
      setBusy(true);
      try {
        await onFile(retryClip);
        // Animate only after upload/enqueue succeeds. Failed sends retain the clip.
        sending.value = withTiming(1, { duration: reducedMotion ? 0 : 180 });
        if (!reducedMotion) await new Promise(resolve => setTimeout(resolve, 180));
        setRetryClip(null);
        onActiveChange(false);
        sending.value = 0;
      } catch (error) {
        onError(error);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
      return;
    }
    if (status.isRecording) {
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
      setLevels(Array(256).fill(4));
      recorder.record({ forDuration: 120 });
      onActiveChange(true);
    } catch (error) {
      onError(error);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <Animated.View
      layout={reducedMotion ? undefined : LinearTransition.duration(220)}
      onLayout={(event) => setWaveWidth(event.nativeEvent.layout.width)}
      style={[{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        justifyContent: "flex-end",
        minHeight: 44,
        borderRadius: 24,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        overflow: "hidden",
        flex: status.isRecording || retryClip ? 1 : undefined,
        paddingLeft: status.isRecording || retryClip ? 14 : 0,
        backgroundColor:
          status.isRecording || retryClip ? theme.primarySoft : "transparent",
      }, sendingStyle]}
    >
      {retryClip ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={c.cancel}
          disabled={busy}
          onPress={() => {
            setRetryClip(null);
            onActiveChange(false);
          }}
          style={{ padding: 8, marginRight: "auto", zIndex: 1 }}
        >
          <Ionicons name="trash-outline" size={22} color={theme.danger} />
        </Pressable>
      ) : null}
      {status.isRecording || retryClip ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeInRight.duration(220)}
          exiting={reducedMotion ? undefined : FadeOutRight.duration(160)}
          accessibilityLabel={c.voice}
          pointerEvents="none"
          style={{
            flexDirection: "row",
            alignItems: "center",
            position: "absolute",
            left: 12,
            right: 12,
            top: 4,
            bottom: 4,
            justifyContent: "space-between",
          }}
        >
          {levels
            .slice(
              -Math.max(2, Math.min(256, Math.floor((waveWidth - 24) / 7))),
            )
            .map((height, index, bars) => {
              const x =
                12 + (index * (waveWidth - 27)) / Math.max(1, bars.length - 1);
              // Fade the waveform before controls, keeping their hit areas clear.
              const rightFade = Math.max(
                0,
                Math.min(1, (waveWidth - 44 - x) / 32),
              );
              const leftFade = retryClip
                ? Math.max(0, Math.min(1, (x - 50) / 32))
                : 1;
              return (
                <View
                  key={index}
                  style={{
                    width: 3,
                    height,
                    borderRadius: 2,
                    backgroundColor: theme.primary,
                    opacity: 0.65 * rightFade * leftFade,
                  }}
                />
              );
            })}
        </Animated.View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          retryClip ? c.send : status.isRecording ? c.stop : c.voice
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
          zIndex: 1,
          backgroundColor: "transparent",
        }}
      >
        <Animated.View
          key={busy ? "busy" : retryClip ? "send" : status.isRecording ? "stop" : "mic"}
          entering={reducedMotion ? undefined : ZoomIn.duration(160)}
          exiting={reducedMotion ? undefined : ZoomOut.duration(120)}
        >
        {busy ? (
          <ActivityIndicator color={String(theme.primary)} />
        ) : (
          <Ionicons
            name={
              retryClip
                ? "arrow-up"
                : status.isRecording
                  ? "stop"
                  : "mic-outline"
            }
            size={23}
            color={status.isRecording ? theme.danger : theme.primary}
          />
        )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
