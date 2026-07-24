import { translate, type TranslationKey } from "@/constants/translations";
import { useAppStore } from "@/store/app-store";

export function useTranslation() {
  const language = useAppStore((state) => state.language);
  return {
    language: language ?? "ru",
    t: (key: TranslationKey) => translate(language, key),
  };
}
