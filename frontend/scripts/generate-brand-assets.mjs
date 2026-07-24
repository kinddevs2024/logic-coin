import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const target = join(process.cwd(), "assets", "brand");

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function encodePng(width, height, pixels) {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    rows[rowOffset] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4).copy(
      rows,
      rowOffset + 1,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function blend(pixels, width, x, y, [r, g, b, a = 255]) {
  if (x < 0 || y < 0 || x >= width || y >= width) return;
  const offset = (Math.floor(y) * width + Math.floor(x)) * 4;
  const sourceAlpha = a / 255;
  const destAlpha = pixels[offset + 3] / 255;
  const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
  if (outAlpha === 0) return;
  pixels[offset] = Math.round(
    (r * sourceAlpha + pixels[offset] * destAlpha * (1 - sourceAlpha)) /
      outAlpha,
  );
  pixels[offset + 1] = Math.round(
    (g * sourceAlpha + pixels[offset + 1] * destAlpha * (1 - sourceAlpha)) /
      outAlpha,
  );
  pixels[offset + 2] = Math.round(
    (b * sourceAlpha + pixels[offset + 2] * destAlpha * (1 - sourceAlpha)) /
      outAlpha,
  );
  pixels[offset + 3] = Math.round(outAlpha * 255);
}

function circle(pixels, size, cx, cy, radius, color, ring = false, thickness = 1) {
  const minX = Math.max(0, Math.floor(cx - radius - 2));
  const maxX = Math.min(size - 1, Math.ceil(cx + radius + 2));
  const minY = Math.max(0, Math.floor(cy - radius - 2));
  const maxY = Math.min(size - 1, Math.ceil(cy + radius + 2));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const inside = ring
        ? distance <= radius && distance >= radius - thickness
        : distance <= radius;
      if (inside) blend(pixels, size, x, y, color);
    }
  }
}

function line(pixels, size, x1, y1, x2, y2, width, color) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - width));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + width));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - width));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + width));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(
        0,
        Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length),
      );
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      if (Math.hypot(x - px, y - py) <= width / 2) {
        blend(pixels, size, x, y, color);
      }
    }
  }
  circle(pixels, size, x1, y1, width / 2, color);
  circle(pixels, size, x2, y2, width / 2, color);
}

function render(size, mode) {
  const pixels = new Uint8Array(size * size * 4);
  const transparent = mode === "adaptive" || mode === "notification" || mode === "splash";
  if (!transparent) {
    const start = [66, 191, 255];
    const middle = [8, 102, 255];
    const end = [86, 60, 231];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const t = (x + y) / (size * 2);
        const local = t < 0.5 ? t * 2 : (t - 0.5) * 2;
        const from = t < 0.5 ? start : middle;
        const to = t < 0.5 ? middle : end;
        const offset = (y * size + x) * 4;
        pixels[offset] = Math.round(from[0] + (to[0] - from[0]) * local);
        pixels[offset + 1] = Math.round(from[1] + (to[1] - from[1]) * local);
        pixels[offset + 2] = Math.round(from[2] + (to[2] - from[2]) * local);
        pixels[offset + 3] = 255;
      }
    }
  }

  const scale = mode === "adaptive" ? 0.72 : mode === "splash" ? 0.78 : 1;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.315 * scale;
  if (transparent && mode !== "notification") {
    circle(pixels, size, cx, cy, radius, [8, 102, 255, 255]);
    circle(pixels, size, cx, cy, radius, [86, 60, 231, 85]);
  } else if (!transparent) {
    circle(pixels, size, cx, cy, radius, [255, 255, 255, 36]);
  }
  const white = [255, 255, 255, 255];
  const ice = mode === "notification" ? white : [199, 235, 255, 255];
  circle(pixels, size, cx, cy, radius, [255, 255, 255, 76], true, size * 0.014);
  const s = scale;
  line(pixels, size, size * 0.41, size * 0.34, size * 0.41, size * 0.63, size * 0.068 * s, white);
  line(pixels, size, size * 0.41, size * 0.63, size * 0.62, size * 0.63, size * 0.068 * s, white);
  line(pixels, size, size * 0.53, size * 0.49, size * 0.68, size * 0.34, size * 0.04 * s, ice);
  line(pixels, size, size * 0.56, size * 0.34, size * 0.68, size * 0.34, size * 0.04 * s, ice);
  line(pixels, size, size * 0.68, size * 0.34, size * 0.68, size * 0.46, size * 0.04 * s, ice);
  return encodePng(size, size, pixels);
}

for (const [name, size, mode] of [
  ["icon.png", 1024, "icon"],
  ["adaptive-icon.png", 1024, "adaptive"],
  ["splash.png", 512, "splash"],
  ["favicon.png", 128, "icon"],
  ["notification-icon.png", 192, "notification"],
]) {
  writeFileSync(join(target, name), render(size, mode));
}

writeFileSync(join(process.cwd(), "public", "icon.png"), render(1024, "icon"));

console.log("Logic Coin brand PNG assets generated.");
