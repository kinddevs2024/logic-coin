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

const uzbekistanAliases = ["Uzbekiston", "Ozbekistan", "Узбекистон", "Ўзбекистон"];
const searchLanguages = ["uz", "ru", "en"] as const;
const priorityCountryCodes = ["UZ", "KZ", "TR"];
const asianCountryCodes = new Set([
  "AE", "AF", "AM", "AZ", "BD", "BH", "BN", "BT", "CN", "CY", "GE", "HK", "ID", "IL",
  "IN", "IQ", "IR", "JO", "JP", "KG", "KH", "KP", "KR", "KW", "KZ", "LA", "LB", "LK",
  "MM", "MN", "MO", "MV", "MY", "NP", "OM", "PH", "PK", "PS", "QA", "SA", "SG", "SY",
  "TH", "TJ", "TL", "TM", "TR", "TW", "UZ", "VN", "YE"
]);

function countryPriority(code: string): number {
  const pinnedPosition = priorityCountryCodes.indexOf(code);
  if (pinnedPosition >= 0) return pinnedPosition;
  return priorityCountryCodes.length + (asianCountryCodes.has(code) ? 0 : 1);
}

function normalizeCountryQuery(text: string) {
  return text.normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f'‘’ʻʼ`´\s.-]/g, "");
}

export function countrySearchIndex(language: Language) {
  const ordered = countryOptions(language).sort((a, b) => countryPriority(a.code) - countryPriority(b.code));
  return ordered.map(option => ({
    option,
    terms: [
      option.code,
      countries.alpha2ToAlpha3(option.code) ?? "",
      option.name,
      ...searchLanguages.flatMap(locale => countries.getName(option.code, locale, { select: "all" }) ?? []),
      ...(option.code === "UZ" ? uzbekistanAliases : [])
    ].map(normalizeCountryQuery).filter(Boolean)
  }));
}

export function searchCountries(index: ReturnType<typeof countrySearchIndex>, text: string): CountryOption[] {
  const query = normalizeCountryQuery(text);
  return index.filter(entry => !query || entry.terms.some(term => term.includes(query))).map(entry => entry.option);
}
