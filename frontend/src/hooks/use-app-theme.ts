import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";

import { themes } from "@/constants/theme";
import { resolveThemePreference } from "@/lib/theme-preference";
import { useAppStore } from "@/store/app-store";

export { resolveThemePreference } from "@/lib/theme-preference";

export function useAppTheme() {
  const preference = useAppStore((state) => state.theme);
  const systemScheme = useColorScheme();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const mode = resolveThemePreference(preference, systemScheme, now);
  return themes[mode] ?? themes.sky;
}
