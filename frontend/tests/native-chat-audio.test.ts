import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ available: false }));
vi.mock("expo-modules-core", () => ({ requireOptionalNativeModule: () => state.available ? {} : null }));
vi.mock("expo-audio", () => { throw new Error("Old APK must not load ExpoAudio"); });
vi.mock("react-native", () => ({ Pressable: "Pressable", View: "View", Linking: {} }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/components/app-text", () => ({ AppText: () => null }));
vi.mock("@/lib/chat-copy", () => ({ useChatCopy: () => ({}) }));
vi.mock("@/hooks/use-app-theme", () => ({ useAppTheme: () => ({}) }));
import { loadChatAudio } from "../src/lib/native-chat-audio";
beforeEach(() => { state.available = false; });
it("opens chat audio controls on APK 11 without evaluating the missing native SDK", async () => {
  expect(typeof (await import("../src/components/chat/voice-recorder.native")).VoiceRecorder).toBe("function");
  expect(typeof (await import("../src/components/chat/voice-player.native")).VoicePlayer).toBe("function");
  const load = vi.fn(() => ({}));
  expect(loadChatAudio(load)).toBeNull();
  expect(load).not.toHaveBeenCalled();
});
it("loads the full audio implementation when the native SDK is installed", () => {
  state.available = true;
  const implementation = {};
  expect(loadChatAudio(() => implementation)).toBe(implementation);
});

it("isolates incompatible native SDK implementations from the chat screen", () => {
  state.available = true;
  expect(loadChatAudio(() => { throw new Error("Native API mismatch"); })).toBeNull();
});
