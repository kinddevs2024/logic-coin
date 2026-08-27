import CountryFlag from "react-native-country-flag";
import { StyleSheet, View } from "react-native";

import type { Language } from "@/types";

const COUNTRY_NAMES: Record<string, Record<Language, string>> = {
  RU: { ru: "Россия", uz: "Rossiya", en: "Russia" },
  UZ: { ru: "Узбекистан", uz: "O‘zbekiston", en: "Uzbekistan" },
  US: { ru: "США", uz: "AQSH", en: "United States" },
};

export function countryName(countryCode: string | null | undefined, language: Language = "ru") {
  if (!countryCode) return language === "ru" ? "Страна не указана" : language === "uz" ? "Mamlakat ko‘rsatilmagan" : "Country not set";
  const code = countryCode.toUpperCase();
  return COUNTRY_NAMES[code]?.[language] ?? code;
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
