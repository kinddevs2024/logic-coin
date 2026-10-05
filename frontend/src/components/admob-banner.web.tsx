import { useEffect, useState } from "react";
import { createElement } from "react";

const CLIENT = "ca-pub-3345266316761728";
const SLOT = "5234789961";

export function AdmobBannerSlot() {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const update = () => setDesktop(window.matchMedia("(min-width: 900px)").matches);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!desktop) return;
    try {
      const adWindow = window as Window & { adsbygoogle?: Array<Record<string, unknown>> };
      (adWindow.adsbygoogle = adWindow.adsbygoogle || []).push({});
    } catch {
      // AdSense may be unavailable while the site is still under review.
    }
  }, [desktop]);

  if (!desktop) return null;
  return createElement(
    "div",
    {
      className: "logic-coin-web-ad",
      style: { width: "100%", minHeight: 100, margin: "14px 0", textAlign: "center" },
      "aria-label": "Advertisement",
    },
    createElement("ins", {
      className: "adsbygoogle",
      style: { display: "block", minHeight: 100 },
      "data-ad-client": CLIENT,
      "data-ad-slot": SLOT,
      "data-ad-format": "auto",
      "data-full-width-responsive": "true",
    }),
  );
}
