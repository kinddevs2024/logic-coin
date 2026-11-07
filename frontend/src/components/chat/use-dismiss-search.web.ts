import { useEffect } from "react";
export function useDismissSearch(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('#chat-list-search')) close();
    };
    document.addEventListener("click", dismiss);
    return () => document.removeEventListener("click", dismiss);
  }, [open, close]);
}
