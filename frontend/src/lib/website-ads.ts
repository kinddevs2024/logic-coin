import { isTelegramMiniApp } from "./telegram-context";

export const WEBSITE_AD_ZONES = {
  inPage: { zone: "11951825", src: "https://nap5k.com/tag.min.js" },
  vignette: { zone: "12151182", src: "https://n6wxm.com/vignette.min.js" },
} as const;

// Each provider zone is inserted once per document. Provider frequency controls
// remain in charge; loading a display tag never grants a rewarded-ad receipt.
export function loadWebsiteAds(includeVignette = false): void {
  if (typeof document === "undefined" || isTelegramMiniApp()) return;
  const zones = includeVignette ? Object.values(WEBSITE_AD_ZONES) : [WEBSITE_AD_ZONES.inPage];
  for (const { zone, src } of zones) {
    if (document.querySelector(`script[data-zone="${zone}"]`)) continue;
    const script = document.createElement("script");
    script.dataset.zone = zone;
    script.src = src;
    script.async = true;
    script.addEventListener("error", () => console.warn(`[Logic Coin Monetag ${zone}] Script blocked or unavailable`), { once: true });
    (document.body ?? document.documentElement).appendChild(script);
  }
}
