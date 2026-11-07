import { createSerialChatRefresh } from "@/lib/chat-sync";
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
    const refreshers = new Map<string, () => Promise<void>>();
    const refresh = (id: string) => {
      let run = refreshers.get(id);
      if (!run) {
        run = createSerialChatRefresh(() => client.invalidateQueries({
          queryKey: id === "*" ? ["chat-messages", token] : ["chat-messages", token, id],
          refetchType: pathname === "/messages" ? "active" : "none",
        }, { cancelRefetch: false }));
        refreshers.set(id, run);
      }
      void run().catch(() => {});
    };
    const unsubscribe = subscribeToChallengeUpdates(token, (state) => {
      if (state.chatSync) {
        refresh("*");
        void client.invalidateQueries({ queryKey: ["chat-list", token] }, { cancelRefetch: false });
      }
      if (!state.chat) return;
      const id = state.chat.conversationId;
      if (id === "friends") {
        void client.invalidateQueries({queryKey:["chat-friend-requests",token]});
        void client.invalidateQueries({queryKey:["chat-profile",token]});
        void client.invalidateQueries({queryKey:["chat-invite-search",token]});
      }
      if (!timers.has(id))
        timers.set(
          id,
          setTimeout(() => {
            timers.delete(id);
            refresh(id);
          }, 400),
        );
      if (!listTimer)
        listTimer = setTimeout(() => {
          listTimer = undefined;
          void client.invalidateQueries({
            queryKey: ["chat-list", token],
            refetchType: "active",
          }, { cancelRefetch: false });
        }, 800);
    });
    return () => {
      unsubscribe();
      if (listTimer) clearTimeout(listTimer);
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, [token, client, pathname]);
  return null;
}
