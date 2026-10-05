import type { ThemeMode } from "@/constants/theme";

/** Preferences from storage/API are runtime data, not guaranteed TypeScript values. */
export function resolveThemePreference(
  preference: unknown,
  systemScheme: string | null | undefined,
  now = new Date(),
): ThemeMode {
  if (preference === "light" || preference === "sky" || preference === "dark") return preference;
  // Resolve auto, legacy or corrupt values before RootLayout reads background.
  const hour = now.getHours();
  return systemScheme === "dark" || hour >= 19 || hour < 7 ? "dark" : "sky";
}
