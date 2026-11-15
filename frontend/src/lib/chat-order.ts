import type { ChatRoom } from "./chat-api";

/** Put conversations requiring attention first; retain the usual order otherwise. */
export function compareChatRooms(a: ChatRoom, b: ChatRoom): number {
  return (
    b.unread - a.unread ||
    Number(b.pinned) - Number(a.pinned) ||
    Number(Boolean(b.isOfficial)) - Number(Boolean(a.isOfficial)) ||
    Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt)
  );
}
