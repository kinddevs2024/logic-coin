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
  onPrimary: ColorValue;
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
    onPrimary: "#FFFFFF",
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
    onPrimary: "#FFFFFF",
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
    background: "#0B1220",
    backgroundStart: "#111D31",
    backgroundMiddle: "#0C1525",
    backgroundEnd: "#090F1C",
    surface: "#152137",
    surfaceRaised: "#1C2A42",
    surfaceMuted: "#24344E",
    text: "#EDF3FC",
    textMuted: "#ACBCD3",
    primary: "#83BBFF",
    primaryDark: "#62A0F5",
    primarySoft: "#1B3558",
    onPrimary: "#08172D",
    border: "#364964",
    success: "#58DDA7",
    warning: "#FFC878",
    danger: "#FF8894",
    shadow: "#000000",
    orbOne: "#305FA4",
    orbTwo: "#41477E",
    tabBar: "rgba(16,29,50,0.94)",
    glassFill: "rgba(21,33,55,0.78)",
    glassFillStrong: "rgba(25,39,62,0.92)",
    glassBorder: "rgba(156,185,225,0.20)",
    glassHighlight: "rgba(190,215,250,0.07)",
    glassTint: "#172D4B",
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
