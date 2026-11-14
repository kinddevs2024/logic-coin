/** Canonical public endpoint on the production server. */
export const MIGRATED_APP_ORIGIN = "https://logic-coin.online";

export function migratedAppUrl(value: string, sameOrigin = false): string {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && ["logic-coin.online", "www.logic-coin.online", ...(sameOrigin ? [new URL(MIGRATED_APP_ORIGIN).hostname] : [])].includes(url.hostname) && !url.port && !url.username && !url.password) {
      return (sameOrigin ? "" : MIGRATED_APP_ORIGIN) + url.pathname + url.search + url.hash;
    }
  } catch { /* Inline images and relative paths remain unchanged. */ }
  return value;
}

/** Rewrite only URL fields, never free-form user messages or external services. */
export function migratedResponseUrls<T>(value: T, sameOriginImages = false): T {
  if (Array.isArray(value)) return value.map(item => migratedResponseUrls(item, sameOriginImages)) as T;
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    typeof item === "string" && /(?:url|uri|link)$/i.test(key)
      ? migratedAppUrl(item, sameOriginImages && /^(avatar|image|icon|thumbnail|banner|cover)Url$/i.test(key)) : migratedResponseUrls(item, sameOriginImages),
  ])) as T;
}
