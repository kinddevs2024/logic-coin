export const FIRST_VISIT_KEY = "logic-coin-first-visit-v1";
export type FirstVisit = { version: 1; referralCode: string | null; visitedAt: number };

export function referralFromUrl(value: string): string | null {
  try {
    const url = new URL(value, "https://logic-coin.online");
    const path = url.protocol === "logiccoin:" ? `/${url.host}${url.pathname}` : url.pathname;
    const match = path.match(/^\/invite\/([^/]+)\/?$/);
    const code = (match ? decodeURIComponent(match[1]) : url.searchParams.get("ref"))?.trim().toUpperCase();
    return code && /^[A-Z0-9-]{4,32}$/.test(code) ? code : null;
  } catch { return null; }
}

export function parseFirstVisit(raw: string | null): FirstVisit | null {
  try {
    const value = JSON.parse(raw ?? "null") as FirstVisit | null;
    if (value?.version !== 1 || !Number.isFinite(value.visitedAt)) return null;
    if (value.referralCode !== null && (typeof value.referralCode !== "string" || !/^[A-Z0-9-]{4,32}$/.test(value.referralCode))) return null;
    return value;
  } catch { return null; }
}

export function createFirstVisitTracker(storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> }) {
  let pending: Promise<FirstVisit> | undefined;
  return (url: string) => pending ??= (async () => {
    let saved: FirstVisit | null = null;
    try { saved = parseFirstVisit(await storage.getItem(FIRST_VISIT_KEY)); } catch { /* Private storage may be unavailable. */ }
    if (saved) return saved;
    const visit: FirstVisit = { version: 1, referralCode: referralFromUrl(url), visitedAt: Date.now() };
    try { await storage.setItem(FIRST_VISIT_KEY, JSON.stringify(visit)); } catch { /* Keep the first visit in memory for this session. */ }
    return visit;
  })();
}
