import { API_URL, ApiError, refreshAccessToken } from "./api";
import type { ChatDraftFile } from "./chat-api";
import { withNetworkDeadline } from "./network-deadline";
export async function uploadChatBinary(token: string, file: ChatDraftFile, retried = false): Promise<{id:string;name:string;kind:string;size:number}> {
  if (!file.blob || file.blob.size > 200 * 1024 * 1024) throw new Error("Maximum file size: 200 MB");
  const query = new URLSearchParams({name:file.name,mime:file.mime,kind:file.kind});
  const response = await withNetworkDeadline(signal => fetch(`${API_URL}/chat/attachments/binary?${query}`, {
    method:"POST", headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/octet-stream"}, body:file.blob, signal,
  }), undefined, 30 * 60_000);
  if (response.status === 401 && !retried) return uploadChatBinary(await refreshAccessToken(token),file,true);
  const payload = await response.json();
  if (!response.ok) throw new ApiError(payload.error?.message || "Upload failed",response.status,payload.error?.code);
  return payload.data;
}
