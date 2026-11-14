import { API_URL, ApiError, refreshAccessToken } from "./api";
import type { ChatDraftFile } from "./chat-api";
export async function uploadChatBinary(token: string, file: ChatDraftFile, retried = false): Promise<{id:string;name:string;kind:string;size:number}> {
  if (!file.uri || (file.size ?? 0) > 200 * 1024 * 1024) throw new Error("Maximum file size: 200 MB");
  const fs = await import("expo-file-system/legacy");
  const query = new URLSearchParams({name:file.name,mime:file.mime,kind:file.kind});
  const response = await fs.uploadAsync(`${API_URL}/chat/attachments/binary?${query}`, file.uri, {
    httpMethod:"POST", uploadType:fs.FileSystemUploadType.BINARY_CONTENT,
    headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/octet-stream"},
  });
  if (response.status === 401 && !retried) return uploadChatBinary(await refreshAccessToken(token),file,true);
  const payload = JSON.parse(response.body);
  if (response.status < 200 || response.status >= 300) throw new ApiError(payload.error?.message || "Upload failed",response.status,payload.error?.code);
  return payload.data;
}
