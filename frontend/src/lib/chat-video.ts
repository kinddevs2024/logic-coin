export function isChatVideo(file: {kind:string;mime:string;name:string}) {
  return file.kind === "file" && (file.mime.startsWith("video/") || /\.(mp4|m4v|webm|mov)$/i.test(file.name));
}
