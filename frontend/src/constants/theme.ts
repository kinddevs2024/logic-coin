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
    background: "#F5F7FA",
    backgroundStart: "#FFFFFF",
    backgroundMiddle: "#F2F6FA",
    backgroundEnd: "#E8EFF6",
    surface: "#FFFFFF",
    surfaceRaised: "#FFFFFF",
    surfaceMuted: "#EEF2F6",
    text: "#101418",
    textMuted: "#69737D",
    primary: "#087CFF",
    primaryDark: "#0064D6",
    primarySoft: "#E7F2FF",
    border: "#DEE5EC",
    success: "#12B76A",
    warning: "#F5A524",
    danger: "#F04438",
    shadow: "#274158",
    orbOne: "#7BC1FF",
    orbTwo: "#B9A8FF",
    tabBar: "rgba(250,252,254,0.84)",
    glassFill: "rgba(255,255,255,0.58)",
    glassFillStrong: "rgba(255,255,255,0.78)",
    glassBorder: "rgba(255,255,255,0.86)",
    glassHighlight: "rgba(255,255,255,0.78)",
    glassTint: "#F0F7FF",
    glassShadow: "#53697C",
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
    background: "#080A0D",
    backgroundStart: "#11161D",
    backgroundMiddle: "#090C10",
    backgroundEnd: "#050608",
    surface: "#13171C",
    surfaceRaised: "#191E24",
    surfaceMuted: "#20262D",
    text: "#F4F8FF",
    textMuted: "#9AACCA",
    primary: "#59A5FF",
    primaryDark: "#1878EA",
    primarySoft: "#142B45",
    border: "#2B323A",
    success: "#39D98A",
    warning: "#FFB84D",
    danger: "#FF6B6B",
    shadow: "#000000",
    orbOne: "#155FAF",
    orbTwo: "#5135A0",
    tabBar: "rgba(17,21,26,0.86)",
    glassFill: "rgba(24,29,35,0.62)",
    glassFillStrong: "rgba(25,30,36,0.82)",
    glassBorder: "rgba(165,206,255,0.24)",
    glassHighlight: "rgba(220,239,255,0.42)",
    glassTint: "#102B4B",
    glassShadow: "#000000",
  },
};

export const radii = {
  sm: 14,
  md: 20,
  lg: 28,
  xl: 36,
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
