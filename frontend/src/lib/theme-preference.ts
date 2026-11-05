import type { ThemeMode } from "@/constants/theme";

/** Preferences from storage/API are runtime data, not guaranteed TypeScript values. */
export function resolveThemePreference(
  preference: unknown,
  systemScheme: string | null | undefined,
  _now = new Date(),
): ThemeMode {
  if (preference === "light" || preference === "sky" || preference === "dark" || preference === "green" || preference === "blue" || preference === "pink" || preference === "graphite") return preference;
  // Resolve auto, legacy or corrupt values before RootLayout reads background.
  return systemScheme === "dark" ? "dark" : "sky";
}
