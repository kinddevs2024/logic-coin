type Hsv = [number, number, number];
const clamp = (v: number, low = 0, high = 1) => Math.max(low, Math.min(high, v));
export function rgbToHsv(r: number, g: number, b: number): Hsv {
  r /= 255; g /= 255; b /= 255;
  const v = Math.max(r, g, b), d = v - Math.min(r, g, b);
  let h = 0;
  if (d) {
    h = v === r ? ((g - b) / d) % 6 : v === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, v ? d / v : 0, v];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgb.map(n => Math.round((n + m) * 255)) as [number, number, number];
}
function hexRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
export function giftPalette(primary: string): [string, string] {
  const body = /^#[a-f\d]{6}$/i.test(primary) ? primary.toLowerCase() : "#007a57";
  const [h, s] = rgbToHsv(...hexRgb(body));
  // Keep the familiar gold for the green brand; other themes get a lighter ribbon.
  const ribbon = s > .2 && h >= 90 && h <= 180 ? "#e7aa25" : "#" + hexRgb(body).map(n => Math.round(n * .55 + 255 * .45).toString(16).padStart(2, "0")).join("");
  return [body, ribbon];
}

/** Port of color_edit_demo.html: soft hue masks, original value and alpha. */
export function recolorGiftPixels(original: Uint8Array, colors: [string, string]): Uint8Array {
  const data = original.slice(), baseHue = [159, 39], tolerance = 24;
  const targets = colors.map(color => rgbToHsv(...hexRgb(color)));
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    if (s < .12) continue;
    const distances = baseHue.map(base => Math.abs(((h - base + 540) % 360) - 180));
    const group = distances[0] <= distances[1] ? 0 : 1, distance = distances[group];
    if (distance > tolerance * 2.2) continue;
    const mix = (1 - clamp((distance - tolerance * .55) / (tolerance * 1.65))) * clamp((s - .12) / .25);
    const [targetHue, targetSaturation] = targets[group];
    const shifted = (targetHue + ((h - baseHue[group] + 540) % 360 - 180) + 360) % 360;
    const hue = (h + (((shifted - h + 540) % 360) - 180) * mix + 360) % 360;
    let saturation = clamp(s * (1 - mix * .38) + targetSaturation * mix * .38);
    // Neutral photo/graphite accents must not leave the old saturated green behind.
    if (targetSaturation < .2) saturation *= 1 - mix * (1 - targetSaturation / .2);
    const rgb = hsvToRgb(hue, saturation, v);
    data.set(rgb, i);
  }
  return data;
}
