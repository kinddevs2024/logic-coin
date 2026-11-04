import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { ChatDraftFile } from "./chat-api";
export async function pickChatPhoto(): Promise<ChatDraftFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    base64: true,
  });
  const a = result.assets?.[0];
  return a?.base64
    ? {
        name: a.fileName || "photo.jpg",
        mime: a.mimeType || "image/jpeg",
        kind: "photo",
        base64: a.base64,
      }
    : null;
}
export async function readChatFile(
  uri: string,
  name: string,
  mime: string,
  kind: ChatDraftFile["kind"],
): Promise<ChatDraftFile> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists && info.size > 8 * 1024 * 1024) throw new Error("8 MB");
  return {
    name,
    mime,
    kind,
    base64: await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    }),
  };
}
export async function pickChatFile(): Promise<ChatDraftFile | null> {
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
  const file = `${FileSystem.cacheDirectory}chat-${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const saved = await FileSystem.downloadAsync(url, file);
  try {
    await Sharing.shareAsync(saved.uri, { mimeType: mime });
  } finally {
    await FileSystem.deleteAsync(saved.uri, { idempotent: true });
  }
}
