type Recipient = { name?: string | null; countryCode?: string | null; preferences?: { language?: string } };
export function renderNotificationTemplate(text: string, user?: Recipient | null) {
  const language = user?.preferences?.language === "en" ? "en" : user?.preferences?.language === "uz" ? "uz" : "ru";
  const fallback = { ru: { name: "Игрок", country: "Страна не указана" }, en: { name: "Player", country: "Country not specified" }, uz: { name: "O‘yinchi", country: "Mamlakat ko‘rsatilmagan" } }[language];
  let country = fallback.country;
  const code = user?.countryCode?.trim().toUpperCase();
  if (code && /^[A-Z]{2}$/.test(code)) {
    try { country = new Intl.DisplayNames([language], { type: "region", fallback: "none" }).of(code) ?? fallback.country; } catch { /* Keep the localized fallback. */ }
  }
  const values = { name: user?.name?.trim() || fallback.name, country };
  return text.replace(/\{(name|country)\}/g, (_, key: keyof typeof values) => values[key]);
}
