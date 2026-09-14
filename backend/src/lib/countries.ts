import countries from "i18n-iso-countries";
import ru from "i18n-iso-countries/langs/ru.json";
import en from "i18n-iso-countries/langs/en.json";
import uz from "i18n-iso-countries/langs/uz.json";
countries.registerLocale(ru);
countries.registerLocale(en);
countries.registerLocale(uz);
export const countryCodes = Object.keys(countries.getAlpha2Codes());
export function validCountry(code: string): boolean { return countryCodes.includes(code.toUpperCase()); }
export function countryLabel(code: string, language = "ru"): string {
  return countries.getName(code.toUpperCase(), language) || countries.getName(code.toUpperCase(), "en") || code;
}
export function resolveCountry(text: string): string | null {
  const query = text.trim().toLocaleLowerCase();
  return countryCodes.find(code => code.toLowerCase() === query || ["ru", "uz", "en"].some(lang => countryLabel(code, lang).toLocaleLowerCase() === query)) ?? null;
}
