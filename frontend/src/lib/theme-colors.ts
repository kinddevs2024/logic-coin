import type { ThemeMode } from "@/constants/theme";

function rgb(color: string): number[] | null {
  if (!/^#[\da-f]{6}$/i.test(color)) return null;
  return [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16));
}

function luminance(channels: number[]) {
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}

export function contrastRatio(foreground: string, background: string) {
  const front = rgb(foreground);
  const back = rgb(background);
  if (!front || !back) return 1;
  const a = luminance(front);
  const b = luminance(back);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Game/brand colors are also used for tiny labels. Lift only the dark-theme
// foreground, preserving its hue and leaving the light/sky palettes untouched.
export function readableAccent(color: string, mode: ThemeMode) {
  const channels = rgb(color);
  if (mode !== "dark" || !channels) return color;
  let result = color;
  for (let step = 1; step <= 20 && contrastRatio(result, "#253650") < 4.5; step += 1) {
    result = `#${channels.map((value) => Math.round(value + (255 - value) * step / 20).toString(16).padStart(2, "0")).join("")}`;
  }
  return result;
}

export function accentForeground(background: string, mode: ThemeMode) {
  if (mode !== "dark") return "#FFFFFF";
  return contrastRatio("#08172D", background) >= contrastRatio("#FFFFFF", background)
    ? "#08172D"
    : "#FFFFFF";
}
