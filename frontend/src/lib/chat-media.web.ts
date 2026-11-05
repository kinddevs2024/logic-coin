import type { ChatDraftFile } from "./chat-api";
async function fileData(
  file: Blob,
  name: string,
  mime: string,
  kind: ChatDraftFile["kind"],
): Promise<ChatDraftFile> {
  if (file.size > 8 * 1024 * 1024) throw new Error("8 MB");
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("File unavailable"));
    reader.readAsDataURL(file);
  });
  return { name, mime, kind, base64 };
}
function pick(
  accept: string,
  kind: ChatDraftFile["kind"],
): Promise<ChatDraftFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    document.body.appendChild(input);
    input.oncancel = () => { input.remove(); resolve(null); };
    input.onchange = () => {
      const f = input.files?.[0];
      input.remove();
      if (!f) {
        resolve(null);
        return;
      }
      void fileData(
        f,
        f.name,
        f.type || "application/octet-stream",
        f.type.startsWith("image/") ? "photo" : kind,
      ).then(resolve, reject);
    };
    input.click();
  });
}
export const pickChatPhoto = () => pick("image/*", "photo");
export const pickChatFile = () => pick("", "file");
export async function readChatFile(
  uri: string,
  name: string,
  mime: string,
  kind: ChatDraftFile["kind"],
) {
  const response = await fetch(uri);
  return fileData(await response.blob(), name, mime, kind);
}
export async function shareChatFile(url: string, name: string, mime: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("File unavailable");
  const file = new File([await response.blob()], name, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return;
  }
  const uri = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = uri;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(uri), 30_000);
}
