import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { chatApi } from "./chat-api";
export type OutgoingChatMessage = {
  clientId: string;
  text: string;
  attachmentIds: string[];
  replyTo?: string;
  queuedAt: number;
};
export function useChatOutbox(
  token: string,
  accountId: string,
  conversationId: string,
  onSent: () => Promise<unknown>,
) {
  const key = `chat-outbox-v1:${accountId}:${conversationId}`;
  const [items, setItems] = useState<OutgoingChatMessage[]>([]);
  const [failed, setFailed] = useState(false);
  const queue = useRef<OutgoingChatMessage[]>([]),
    working = useRef(false),
    loaded = useRef(false),
    alive = useRef(true),
    callback = useRef(onSent);
  useEffect(() => {
    callback.current = onSent;
  }, [onSent]);
  const persist = useCallback(
    async (next: OutgoingChatMessage[]) => {
      queue.current = next;
      setItems(next);
      await AsyncStorage.setItem(key, JSON.stringify(next));
    },
    [key],
  );
  const flush = useCallback(async () => {
    if (!loaded.current || working.current || !alive.current) return;
    working.current = true;
    try {
      while (queue.current.length && alive.current) {
        const item = queue.current[0]!;
        await chatApi.send(token, conversationId, {
          clientId: item.clientId, text: item.text, attachmentIds: item.attachmentIds, replyTo: item.replyTo,
        });
        if (!alive.current) return;
        // Keep the local bubble visible until the server history has caught up.
        await callback.current();
        if (!alive.current) return;
        await persist(
          queue.current.filter((entry) => entry.clientId !== item.clientId),
        );
        setFailed(false);
      }
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      working.current = false;
    }
  }, [token, conversationId, persist]);
  useEffect(() => {
    alive.current = true;
    void AsyncStorage.getItem(key)
      .then((raw) => {
        if (!alive.current) return;
        const value: unknown = raw ? JSON.parse(raw) : [];
        const saved = Array.isArray(value)
          ? value
              .filter((v): v is OutgoingChatMessage =>
                Boolean(
                  v &&
                    typeof v === "object" &&
                    typeof v.clientId === "string" &&
                    typeof v.text === "string" &&
                    Array.isArray(v.attachmentIds),
                ),
              )
              .slice(0, 20)
          : [];
        queue.current = saved;
        setItems(saved);
        loaded.current = true;
        void flush();
      })
      .catch(() => {
        loaded.current = true;
      });
    const timer = setInterval(() => {
      void flush();
    }, 15_000);
    return () => {
      alive.current = false;
      loaded.current = false;
      clearInterval(timer);
    };
  }, [key, flush]);
  const enqueue = async (
    text: string,
    attachmentIds: string[],
    replyTo?: string,
  ) => {
    if (!loaded.current || queue.current.length >= 20)
      throw new Error("Outbox is full");
    const item = {
      clientId: Crypto.randomUUID(),
      text,
      attachmentIds,
      ...(replyTo ? { replyTo } : {}),
      queuedAt: Date.now(),
    };
    await persist([...queue.current, item]);
    void flush();
  };
  return { items, failed, enqueue, retry: flush };
}
