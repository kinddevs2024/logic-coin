import type { ColorValue } from "react-native";

export type ThemeMode = "light" | "sky" | "dark";

export type ThemeTokens = {
  mode: ThemeMode;
  background: ColorValue;
  backgroundStart: ColorValue;
  backgroundMiddle: ColorValue;
  backgroundEnd: ColorValue;
  surface: ColorValue;
  surfaceRaised: ColorValue;
  surfaceMuted: ColorValue;
  text: ColorValue;
  textMuted: ColorValue;
  primary: ColorValue;
  primaryDark: ColorValue;
  primarySoft: ColorValue;
  border: ColorValue;
  success: ColorValue;
  warning: ColorValue;
  danger: ColorValue;
  shadow: ColorValue;
  orbOne: ColorValue;
  orbTwo: ColorValue;
  tabBar: ColorValue;
  glassFill: ColorValue;
  glassFillStrong: ColorValue;
  glassBorder: ColorValue;
  glassHighlight: ColorValue;
  glassTint: ColorValue;
  glassShadow: ColorValue;
};

export const themes: Record<ThemeMode, ThemeTokens> = {
  light: {
    mode: "light",
    background: "#ECF7FF",
    backgroundStart: "#F8FCFF",
    backgroundMiddle: "#DFF1FF",
    backgroundEnd: "#C7E4FF",
    surface: "#FFFFFF",
    surfaceRaised: "#FFFFFF",
    surfaceMuted: "#EFF5FF",
    text: "#0D1B35",
    textMuted: "#5E6B82",
    primary: "#0860F0",
    primaryDark: "#004BC8",
    primarySoft: "#E8F1FF",
    border: "#E0E9F8",
    success: "#12B76A",
    warning: "#F5A524",
    danger: "#F04438",
    shadow: "#0759E5",
    orbOne: "#73C7FF",
    orbTwo: "#C2B4FF",
    tabBar: "rgba(244,250,255,0.74)",
    glassFill: "rgba(247,252,255,0.54)",
    glassFillStrong: "rgba(250,253,255,0.76)",
    glassBorder: "rgba(255,255,255,0.82)",
    glassHighlight: "rgba(255,255,255,0.92)",
    glassTint: "#E9F6FF",
    glassShadow: "#4A9FE8",
  },
  sky: {
    mode: "sky",
    background: "#DFF3FF",
    backgroundStart: "#F1FBFF",
    backgroundMiddle: "#D7F0FF",
    backgroundEnd: "#B9DFFF",
    surface: "#F9FCFF",
    surfaceRaised: "#FFFFFF",
    surfaceMuted: "#DFF0FF",
    text: "#082449",
    textMuted: "#57708D",
    primary: "#006AC7",
    primaryDark: "#0059A8",
    primarySoft: "#DDF0FF",
    border: "#CFE5F8",
    success: "#0DA968",
    warning: "#E89517",
    danger: "#E84A5F",
    shadow: "#0878D8",
    orbOne: "#45B8FF",
    orbTwo: "#83E6ED",
    tabBar: "rgba(239,249,255,0.72)",
    glassFill: "rgba(238,249,255,0.5)",
    glassFillStrong: "rgba(246,252,255,0.76)",
    glassBorder: "rgba(255,255,255,0.78)",
    glassHighlight: "rgba(255,255,255,0.9)",
    glassTint: "#DDF3FF",
    glassShadow: "#208BCB",
  },
  dark: {
    mode: "dark",
    background: "#081225",
    backgroundStart: "#13253D",
    backgroundMiddle: "#08182E",
    backgroundEnd: "#06101F",
    surface: "#101D34",
    surfaceRaised: "#14243F",
    surfaceMuted: "#192C4A",
    text: "#F4F8FF",
    textMuted: "#9AACCA",
    primary: "#69AEFF",
    primaryDark: "#237BE8",
    primarySoft: "#17365E",
    border: "#263C5D",
    success: "#39D98A",
    warning: "#FFB84D",
    danger: "#FF6B6B",
    shadow: "#000000",
    orbOne: "#1768B8",
    orbTwo: "#6747B5",
    tabBar: "rgba(12,27,49,0.72)",
    glassFill: "rgba(22,42,69,0.5)",
    glassFillStrong: "rgba(18,35,60,0.76)",
    glassBorder: "rgba(165,206,255,0.24)",
    glassHighlight: "rgba(220,239,255,0.42)",
    glassTint: "#102B4B",
    glassShadow: "#000000",
  },
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
