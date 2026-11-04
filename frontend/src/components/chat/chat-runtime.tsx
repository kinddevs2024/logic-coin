import { useEffect } from "react";
import { usePathname } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/app-store";
import { subscribeToChallengeUpdates } from "@/lib/challenge-live-updates";
export function ChatRuntime() {
  const token = useAppStore((s) => s.accessToken),
    client = useQueryClient(),
    pathname = usePathname();
  useEffect(() => {
    if (!token) return;
    let listTimer: ReturnType<typeof setTimeout> | undefined;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const unsubscribe = subscribeToChallengeUpdates(token, (state) => {
      if (!state.chat) return;
      const id = state.chat.conversationId;
      if (!timers.has(id))
        timers.set(
          id,
          setTimeout(() => {
            timers.delete(id);
            void client.invalidateQueries({
              queryKey: ["chat-messages", token, id],
              refetchType: pathname === "/messages" ? "active" : "none",
            });
          }, 400),
        );
      if (!listTimer)
        listTimer = setTimeout(() => {
          listTimer = undefined;
          void client.invalidateQueries({
            queryKey: ["chat-list", token],
            refetchType: pathname === "/messages" ? "active" : "none",
          });
        }, 3000);
    });
    return () => {
      unsubscribe();
      if (listTimer) clearTimeout(listTimer);
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, [token, client, pathname]);
  return null;
}
