import CountryFlag from "react-native-country-flag";
import { StyleSheet, View } from "react-native";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import ruLocale from "i18n-iso-countries/langs/ru.json";
import uzLocale from "i18n-iso-countries/langs/uz.json";

import type { Language } from "@/types";

countries.registerLocale(enLocale);
countries.registerLocale(ruLocale);
countries.registerLocale(uzLocale);

export type CountryOption = { code: string; name: string };

export function countryOptions(language: Language = "ru"): CountryOption[] {
  const names = countries.getNames(language, { select: "official" });
  return Object.keys(countries.getAlpha2Codes())
    .map((code) => ({ code, name: names[code] ?? countries.getName(code, "en") ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, language));
}

export function countryName(countryCode: string | null | undefined, language: Language = "ru") {
  if (!countryCode) return language === "ru" ? "Страна не указана" : language === "uz" ? "Mamlakat ko‘rsatilmagan" : "Country not set";
  const code = countryCode.toUpperCase();
  return countries.getName(code, language) ?? countries.getName(code, "en") ?? code;
}

export function CountryFlagBadge({ countryCode, size = 28 }: { countryCode?: string | null; size?: number }) {
  if (!countryCode) return null;
  return (
    <View style={[styles.wrap, { height: size, width: Math.round(size * 1.48), borderRadius: Math.max(5, Math.round(size * 0.24)) }]}>
      <CountryFlag isoCode={countryCode.toLowerCase()} size={size} style={styles.flag} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(16,42,76,0.17)",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  flag: { margin: 0 },
});
