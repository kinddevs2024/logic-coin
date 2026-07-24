import { themes } from "@/constants/theme";
import { useAppStore } from "@/store/app-store";

export function useAppTheme() {
  const mode = useAppStore((state) => state.theme);
  return themes[mode];
}
