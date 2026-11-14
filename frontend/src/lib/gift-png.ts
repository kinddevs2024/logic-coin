import { zlibSync } from "fflate";

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function uint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}
function join(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function chunk(type: string, data: Uint8Array) {
  const bytes = join([Uint8Array.from(type, c => c.charCodeAt(0)), data]);
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return join([uint32(data.length), bytes, uint32((crc ^ 0xffffffff) >>> 0)]);
}
/** Small RGBA8 encoder: no browser Canvas, TextDecoder or native image modules. */
export function encodeGiftPng(width: number, height: number, rgba: Uint8Array) {
  if (rgba.length !== width * height * 4) throw new Error("Invalid gift pixels");
  const scanlines = new Uint8Array((width * 4 + 1) * height);
  for (let row = 0; row < height; row++) scanlines.set(rgba.subarray(row * width * 4, (row + 1) * width * 4), row * (width * 4 + 1) + 1);
  return join([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", join([uint32(width), uint32(height), new Uint8Array([8, 6, 0, 0, 0])])),
    chunk("IDAT", zlibSync(scanlines, { level: 4 })), chunk("IEND", new Uint8Array()),
  ]);
}
