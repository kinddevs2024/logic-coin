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

export function prioritizeOfficialChatRooms(rooms: readonly ChatRoom[]): ChatRoom[] {
  const priority = (room: ChatRoom) => {
    if (room.systemKey === "news") return 0;
    if (room.systemKey === "community") return 1;
    if (room.kind === "support" && room.isOfficial) return 2;
    return 3;
  };
  return [...rooms].sort((a, b) => priority(a) - priority(b));
}
