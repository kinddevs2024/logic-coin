import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useIsFocused } from "expo-router";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";

const CLIENT = "ca-pub-3345266316761728";
const SLOTS = { top: "5234789961", left: "8329614753", right: "3467995303" };
type AdQueue = { loaded?: boolean; push: (entry: Record<string, never>) => unknown };
type AdsWindow = Window & { adsbygoogle?: AdQueue };
let loader: Promise<void> | undefined;

// Owned by the source component: Expo's single-page export does not render +html.
// One loader per page, with errors surfaced instead of silently swallowed.
function loadAdSense() {
  const adWindow = window as AdsWindow;
  if (adWindow.adsbygoogle?.loaded) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
    const script = existing ?? document.createElement("script");
    const finish = (error?: Error) => {
      clearTimeout(timer);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      if (error) reject(error); else resolve();
    };
    const onLoad = () => finish();
    const onError = () => finish(new Error("AdSense script blocked or unavailable"));
    const timer = window.setTimeout(() => finish(new Error("AdSense script timed out")), 15000);
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    if (!existing) {
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
      document.head.appendChild(script);
    }
  });
  return loader;
}

function DisplayAd({ slot, horizontal, focused }: { slot: string; horizontal?: boolean; focused: boolean }) {
  const insRef = useRef<HTMLModElement>(null);
  const requested = useRef(false);
  const [state, setState] = useState("waiting");
  const collapsed = state === "unfilled" || state === "error";

  useEffect(() => {
    const ins = insRef.current;
    if (!ins || !focused || requested.current) return;
    let active = true;
    let starting = false;
    const start = () => {
      if (!active || starting || requested.current || ins.getBoundingClientRect().width < 250) return;
      starting = true;
      setState("loading");
      void loadAdSense().then(() => {
        if (!active) return;
        if (ins.getBoundingClientRect().width < 250) { starting = false; return; }
        if (!ins.hasAttribute("data-adsbygoogle-status")) {
          requested.current = true;
          const adWindow = window as AdsWindow;
          const queue: AdQueue = adWindow.adsbygoogle ?? ([] as Record<string, never>[]);
          adWindow.adsbygoogle = queue;
          queue.push({});
        }
        setState(ins.getAttribute("data-ad-status") || "requested");
      }).catch((error: unknown) => {
        if (!active) return;
        setState("error");
        console.warn(`[Logic Coin AdSense ${slot}]`, error);
      });
    };
    // Wait until a mounted tab has a measurable width. No repeated ad refreshes.
    const resize = new ResizeObserver(start);
    resize.observe(ins);
    start();
    return () => { active = false; resize.disconnect(); };
  }, [focused, slot]);

  useEffect(() => {
    const ins = insRef.current;
    if (!ins) return;
    const update = () => {
      const status = ins.getAttribute("data-ad-status");
      if (status) setState(status);
    };
    const observer = new MutationObserver(update);
    observer.observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });
    update();
    return () => observer.disconnect();
  }, []);

  return (
    <section aria-label="Реклама" data-ad-placement={slot} data-ad-state={state}
      style={{ display: collapsed ? "none" : "block", width: "100%", minWidth: 0, textAlign: "center" }}>
      <div style={{ color: "#7E91AC", fontSize: 11, lineHeight: "18px", marginBottom: 6 }}>Реклама</div>
      <ins ref={insRef} className="adsbygoogle"
        style={{ display: "block", width: "100%", minHeight: horizontal ? 90 : 250 }}
        data-ad-client={CLIENT} data-ad-slot={slot}
        data-ad-format={horizontal ? "horizontal" : "rectangle"}
        data-full-width-responsive="false" />
    </section>
  );
}

export function HomeDesktopAds({ position }: { position: "top" | "bottom" }) {
  const { isDesktop, width } = useResponsiveLayout();
  const focused = useIsFocused();
  useEffect(() => {
    // Ordinary display advertising only: no coins, click incentives or refresh loops.
    if (!focused || position !== "top" || document.querySelector('script[data-zone="11951825"]')) return;
    const script = document.createElement("script");
    script.dataset.zone = "11951825";
    script.async = true;
    script.src = "https://nap5k.com/tag.min.js";
    script.addEventListener("error", () => console.warn("[Logic Coin Monetag] Script blocked or unavailable"), { once: true });
    (document.body ?? document.documentElement).appendChild(script);
  }, [focused, position]);
  if (width === 0) return null;
  const style: CSSProperties = {
    width: "100%", minWidth: 0, flexShrink: 0, margin: isDesktop ? "16px 0" : "12px 0",
    display: "grid", gap: isDesktop ? 24 : 16,
    gridTemplateColumns: position === "bottom" && isDesktop ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
  };
  return (
    <div data-home-ad-row={position} data-home-ad-layout={isDesktop ? "desktop" : "mobile"} style={style}>
      {position === "top" ? <DisplayAd slot={SLOTS.top} horizontal focused={focused} /> : <>
        <DisplayAd slot={SLOTS.left} focused={focused} />
        <DisplayAd slot={SLOTS.right} focused={focused} />
      </>}
    </div>
  );
}
