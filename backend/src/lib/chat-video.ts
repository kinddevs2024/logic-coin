export function chatVideoMime(name: string, prefix: Buffer): string | null {
  if (/\.(mp4|m4v|mov)$/i.test(name) && prefix.subarray(4,8).toString() === "ftyp")
    return /\.mov$/i.test(name) ? "video/quicktime" : "video/mp4";
  if (/\.webm$/i.test(name) && prefix.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))
    return "video/webm";
  return null;
}
