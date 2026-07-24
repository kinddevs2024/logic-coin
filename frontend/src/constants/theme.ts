import type { ColorValue } from "react-native";

export type ThemeMode = "light" | "sky" | "dark";

export type ThemeTokens = {
  mode: ThemeMode;
  background: ColorValue;
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
};

export const themes: Record<ThemeMode, ThemeTokens> = {
  light: {
    mode: "light",
    background: "#F7FAFF",
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
    orbOne: "#BBD8FF",
    orbTwo: "#D9C8FF",
    tabBar: "#FFFFFF",
  },
  sky: {
    mode: "sky",
    background: "#EDF7FF",
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
    orbOne: "#91D6FF",
    orbTwo: "#B4F0F2",
    tabBar: "#F8FCFF",
  },
  dark: {
    mode: "dark",
    background: "#081225",
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
    orbOne: "#11457F",
    orbTwo: "#412B73",
    tabBar: "#0D192C",
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
