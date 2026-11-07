import type { ThemeTokens } from "../constants/theme";

export function brandPreviewTheme(base: ThemeTokens): ThemeTokens {
  if (base.mode === "dark") return {
    ...base, background: "#0D1713", backgroundStart: "#18271D", backgroundMiddle: "#101E17", backgroundEnd: "#09120E",
    surface: "#182A21", surfaceRaised: "#20372B", surfaceMuted: "#2C4435",
    text: "#F4F7EF", textMuted: "#B8CCBC", primary: "#52E4B2", primaryDark: "#35C998", primarySoft: "#193E2E", onPrimary: "#082219",
    border: "#405B48", success: "#52E4B2", warning: "#F4CC65", shadow: "#000000",
    orbOne: "#176648", orbTwo: "#846729", tabBar: "rgba(16,30,23,0.94)",
    glassFill: "rgba(24,42,33,0.78)", glassFillStrong: "rgba(32,55,43,0.92)", glassBorder: "rgba(162,212,180,0.20)",
    glassHighlight: "rgba(245,225,168,0.09)", glassTint: "#1B3427", glassShadow: "#000000",
  };
  return {
    ...base, background: "#EDF5E9", backgroundStart: "#FFFCF0", backgroundMiddle: "#E8F6EC", backgroundEnd: "#CCEADA",
    surface: "#FCFFF8", surfaceRaised: "#FFFFFF", surfaceMuted: "#E1EFE3",
    text: "#153B2B", textMuted: "#526C5C", primary: "#007A57", primaryDark: "#006345", primarySoft: "#D8F2E3", onPrimary: "#FFFFFF",
    border: "#CBDDCD", success: "#007A57", warning: "#966800", shadow: "#326F50",
    orbOne: "#78DDB0", orbTwo: "#F0D48C", tabBar: "rgba(245,252,240,0.84)",
    glassFill: "rgba(249,255,241,0.58)", glassFillStrong: "rgba(255,253,241,0.80)", glassBorder: "rgba(255,252,231,0.88)",
    glassHighlight: "rgba(255,255,238,0.88)", glassTint: "#E7F5E8", glassShadow: "#60846B",
  };
}
