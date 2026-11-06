import { requireOptionalNativeModule } from "expo-modules-core";
/** Older signed APKs can receive chat OTA updates without the native audio SDK. */
export function loadChatAudio<T>(load: () => T): T | null {
  try {
    if (!requireOptionalNativeModule("ExpoAudio")) return null;
    return load();
  } catch {
    // A native SDK/API mismatch must never prevent opening text conversations.
    return null;
  }
}
