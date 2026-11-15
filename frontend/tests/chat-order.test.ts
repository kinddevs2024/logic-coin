import { expect, it } from "vitest";
import { compareChatRooms } from "../src/lib/chat-order";
import type { ChatRoom } from "../src/lib/chat-api";

const room = (id: string, unread: number, pinned = false, isOfficial = false, lastMessageAt = "2026-11-15T00:00:00Z") =>
  ({ id, unread, pinned, isOfficial, lastMessageAt }) as ChatRoom;

it("puts the most unread messages first, ahead of pinned and official chats", () => {
  const chats = [room("official", 0, true, true), room("one", 1), room("two", 2)];
  expect(chats.sort(compareChatRooms).map(chat => chat.id)).toEqual(["two", "one", "official"]);
});

it("preserves pinned, official and recency ordering for equal unread counts", () => {
  const chats = [room("old", 0), room("official", 0, false, true), room("new", 0, false, false, "2026-11-15T01:00:00Z"), room("pinned", 0, true)];
  expect(chats.sort(compareChatRooms).map(chat => chat.id)).toEqual(["pinned", "official", "new", "old"]);
});

it("moves a chat down after its messages have been read", () => {
  const a = room("a", 3);
  const b = room("b", 1);
  expect([a, b].sort(compareChatRooms)[0]?.id).toBe("a");
  a.unread = 0;
  expect([a, b].sort(compareChatRooms)[0]?.id).toBe("b");
});
