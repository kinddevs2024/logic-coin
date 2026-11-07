import { createContext, useContext, useMemo } from "react";
import type { ThemeTokens } from "@/constants/theme";
import { useColorScheme } from "react-native";

import { themes } from "@/constants/theme";
import { appearanceTheme } from "@/lib/appearance-theme";
import { resolveThemePreference } from "@/lib/theme-preference";
import { useAppStore } from "@/store/app-store";

export { resolveThemePreference } from "@/lib/theme-preference";
export const AppThemeOverride = createContext<ThemeTokens | null>(null);

export function useAppTheme() {
  const override = useContext(AppThemeOverride);
  const preference = useAppStore((state) => state.theme);
  const systemScheme = useColorScheme();
  const custom = useAppStore((state) => state.user.preferences?.customTheme);
  const mode = resolveThemePreference(preference, systemScheme);
  const theme = useMemo(() => preference === "custom" && custom?.wallpaperUrl
    ? {...appearanceTheme(themes.sky, "custom", custom), wallpaperUrl: custom.wallpaperUrl}
    : themes[mode] ?? themes.sky, [preference, custom, mode]);
  return override ?? theme;
}
