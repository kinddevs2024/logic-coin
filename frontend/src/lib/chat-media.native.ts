import {requireOptionalNativeModule} from "expo-modules-core";
import * as ImagePicker from "expo-image-picker";
import type { ChatDraftFile } from "./chat-api";
export async function pickChatPhoto(): Promise<ChatDraftFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    base64: false,
  });
  const a = result.assets?.[0];
  return a ? readChatFile(a.uri, a.fileName || "photo.jpg", a.mimeType || "image/jpeg", "photo") : null;
}
export async function readChatFile(
  uri: string,
  name: string,
  mime: string,
  kind: ChatDraftFile["kind"],
): Promise<ChatDraftFile> {
  const FileSystem=await import("expo-file-system/legacy");
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists && info.size > 200 * 1024 * 1024) throw new Error("Maximum file size: 200 MB");
  return {
    name,
    mime,
    kind,
    uri,
    size: info.exists ? info.size : 0,
  };
}
export async function pickChatFile(): Promise<ChatDraftFile | null> {
  if(!requireOptionalNativeModule("ExpoDocumentPicker"))throw new Error("Для отправки файлов установите новый APK Logic Coin 1.4.1: https://logic-coin.online/downloads/logic-coin-latest.apk");
  const DocumentPicker=await import("expo-document-picker");
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
  });
  const a = result.assets?.[0];
  return a
    ? readChatFile(
        a.uri,
        a.name,
        a.mimeType || "application/octet-stream",
        a.mimeType?.startsWith("image/") ? "photo" : "file",
      )
    : null;
}
export async function shareChatFile(url: string, name: string, mime: string) {
  if(!requireOptionalNativeModule("ExpoSharing"))throw new Error("Для отправки файлов в другие приложения установите новый APK Logic Coin 1.4.1.");
  const Sharing=await import("expo-sharing");
  const FileSystem=await import("expo-file-system/legacy");
  const file = `${FileSystem.cacheDirectory}chat-${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const saved = await FileSystem.downloadAsync(url, file);
  try {
    await Sharing.shareAsync(saved.uri, { mimeType: mime });
  } finally {
    await FileSystem.deleteAsync(saved.uri, { idempotent: true });
  }
}
