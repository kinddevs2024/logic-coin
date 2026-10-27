/** Independent HTTPS endpoint on the new server; no legacy DNS lookup is needed. */
export const MIGRATED_APP_ORIGIN = "https://logic-coin.173.212.216.216.sslip.io";

export function migratedAppUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && ["logic-coin.online", "www.logic-coin.online"].includes(url.hostname) && !url.port && !url.username && !url.password) {
      return MIGRATED_APP_ORIGIN + url.pathname + url.search + url.hash;
    }
  } catch { /* Inline images and relative paths remain unchanged. */ }
  return value;
}

/** Rewrite only URL fields, never free-form user messages or external services. */
export function migratedResponseUrls<T>(value: T): T {
  if (Array.isArray(value)) return value.map(migratedResponseUrls) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    typeof item === "string" && /(?:url|uri|link)$/i.test(key)
      ? migratedAppUrl(item) : migratedResponseUrls(item),
  ])) as T;
}
