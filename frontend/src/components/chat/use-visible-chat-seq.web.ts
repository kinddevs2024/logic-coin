import { useEffect } from "react";

// Browser layout can place a short history at the bottom of a flex container.
// Observe the actual message rectangles instead of relying on virtual row offsets.
export function useVisibleChatSeq(enabled: boolean, onRead: (seq: number, visible: number[]) => void) {
  useEffect(() => {
    if (!enabled) return;
    const observed = new Set<Element>();
    const observer = new IntersectionObserver(entries => {
      if (document.visibilityState !== "visible") return;
      const visible = entries.filter(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)
        .map(entry => Number(entry.target.id.slice("chat-seq-".length))).filter(Number.isFinite);
      const seq = Math.max(0, ...visible);
      if (seq) onRead(seq, visible);
    }, { threshold: 0.5 });
    const scan = () => document.querySelectorAll('[id^="chat-seq-"]').forEach(node => {
      if (!observed.has(node)) { observed.add(node); observer.observe(node); }
    });
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true });
    const refresh = () => { observer.disconnect(); observed.clear(); scan(); };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      observer.disconnect(); mutations.disconnect();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, onRead]);
}
