import type { ChatDraftFile } from "./chat-api";
// The existing profile wallpaper endpoint accepts compact image data, while
// chat attachments use streaming binary uploads.
export async function chatPhotoData(file: ChatDraftFile): Promise<{mime:string;base64:string}> {
  if ((file.size ?? 0) > 8 * 1024 * 1024) throw new Error("Photo is too large");
  if (file.base64) return {mime:file.mime,base64:file.base64};
  if (file.uri) {
    const fs = await import("expo-file-system/legacy");
    return {mime:file.mime,base64:await fs.readAsStringAsync(file.uri,{encoding:fs.EncodingType.Base64})};
  }
  if (!file.blob) throw new Error("Photo unavailable");
  const base64 = await new Promise<string>((resolve,reject) => {
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror=()=>reject(new Error("Photo unavailable"));
    reader.readAsDataURL(file.blob!);
  });
  return {mime:file.mime,base64};
}
