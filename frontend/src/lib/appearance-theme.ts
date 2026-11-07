import type {ThemeTokens} from "@/constants/theme";
function mix(hex: string, target: number, amount: number) {
  return "#" + [1, 3, 5].map(start => Math.round(parseInt(hex.slice(start, start + 2), 16) * (1 - amount) + target * amount).toString(16).padStart(2, "0")).join("");
}
export function appearanceTheme(base: ThemeTokens, preset: string, appearance?: {accent?:string|null;dark?:boolean}): ThemeTokens {
  const accent = preset === "blue" ? "#2484ce" : preset === "pink" ? "#e58ab5" : preset === "graphite" ? "#a9b8c9" : preset === "custom" && /^#[0-9a-f]{6}$/i.test(appearance?.accent ?? "") ? appearance!.accent! : "#007c59";
  const dark = preset === "pink" || preset === "graphite" || (preset === "custom" && appearance?.dark);
  return ({
    ...base,
    wallpaperUrl: undefined,
    mode: dark ? "dark" as const : "light" as const,
    backgroundStart: dark ? mix(accent,0,0.82) : mix(accent,255,0.97),
    backgroundMiddle: dark ? mix(accent,0,0.88) : mix(accent,255,0.94),
    backgroundEnd: dark ? mix(accent,0,0.92) : mix(accent,255,0.88),
    glassHighlight: dark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.55)",
    glassShadow: dark ? "#000000" : mix(accent,0,0.45),
    shadow: dark ? "#000000" : mix(accent,0,0.45),
    orbOne: accent, orbTwo: accent,
    tabBar: dark ? mix(accent,0,0.82) : mix(accent,255,0.94),
    glassFill: dark ? mix(accent,0,0.82) : mix(accent,255,0.96),
    glassFillStrong: dark ? mix(accent,0,0.76) : mix(accent,255,0.98),
    glassBorder: dark ? mix(accent,0,0.65) : mix(accent,255,0.8),
    glassTint: dark ? mix(accent,0,0.8) : mix(accent,255,0.92),
    background: preset === "green" ? "#edf5e8" : dark ? mix(accent, 0, 0.88) : mix(accent, 255, 0.94),
    surface: dark ? mix(accent, 0, 0.82) : "#fbfff9",
    surfaceRaised: dark ? mix(accent, 0, 0.76) : "#ffffff",
    surfaceMuted: dark ? mix(accent, 0, 0.8) : mix(accent, 255, 0.92),
    text: dark ? "#f6f7fa" : mix(accent, 0, 0.8),
    textMuted: dark ? "#bcc7cd" : mix(accent, 0, 0.35),
    primary: accent,
    primaryDark: accent,
    primarySoft: dark ? mix(accent, 0, 0.65) : mix(accent, 255, 0.85),
    onPrimary: dark ? "#142029" : "#ffffff",
    border: dark ? mix(accent, 0, 0.65) : mix(accent, 255, 0.8),
  });

}
