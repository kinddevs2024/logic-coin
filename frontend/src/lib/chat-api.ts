import { API_URL, authenticatedRequest as request } from "./api";
export type ChatPerson = {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  referralCode?: string;
};
export type ChatRoom = {
  chatTheme?: { preset: "system" | "green" | "blue" | "pink" | "graphite" | "custom"; accent?: string | null; dark?: boolean; wallpaperUrl?: string | null };
  id: string;
  kind: "direct" | "support" | "group" | "channel";
  isOfficial?: boolean;
  systemKey: "news" | "community" | null;
  title: string;
  description: string;
  username?: string | null;
  visibility?: "public" | "invite";
  avatarUrl?: string | null;
  peer: ChatPerson | null;
  unread: number;
  lastSeq: number;
  peerReadSeq: number;
  lastMessageAt: string;
  preview: string;
  hasAttachment: boolean;
  muted: boolean;
  pinned: boolean;
  canPost: boolean;
  canManage: boolean;
  canEditInfo: boolean;
  canPromote: boolean;
  isOwner: boolean;
  inviteCode: string | null;
};
export type ChatFile = {
  id: string;
  name: string;
  mime: string;
  kind: "photo" | "file" | "voice";
  size: number;
  url: string;
};
export type ChatItem = {
  id: string;
  seq: number;
  sender: ChatPerson;
  text: string;
  createdAt: string;
  edited: boolean;
  deleted: boolean;
  pinned: boolean;
  forwardedFrom: string | null;
  reply: { id: string; text: string; sender: string } | null;
  attachments: ChatFile[];
  reactions: { userId: string; emoji: string; user?: ChatPerson }[];
  own: boolean;
  voiceListened?: boolean;
};
export type ChatDraftFile = {
  name: string;
  mime: string;
  kind: ChatFile["kind"];
  base64: string;
};
const call = <T>(
  token: string,
  endpoint: string,
  method = "GET",
  body?: unknown,
) =>
  request<T>(`/chat${endpoint}`, {
    token,
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
export const chatApi = {
  directory: (token:string,q="",cursor="")=>call<{users:(ChatPerson & {friendship:string})[];next:string|null}>(token,`/directory?q=${encodeURIComponent(q)}${cursor?`&cursor=${cursor}`:""}`),
  theme: (token: string, id: string, preset: NonNullable<ChatRoom["chatTheme"]>["preset"], wallpaperAttachmentId?: string) => call<{ok: boolean}>(token, `/${id}/theme`, "PATCH", {preset, ...(wallpaperAttachmentId ? {wallpaperAttachmentId} : {})}),
  list: (token: string) => call<{ chats: ChatRoom[] }>(token, "/"),
  search: (token: string, q: string) =>
    call<{
      users: ChatPerson[];
      messages?: { id: string; conversationId: string; text: string }[];
      rooms: {
        id: string;
        title: string;
        kind: string;
        description: string;
        username?: string | null;
        inviteCode: string;
      }[];
    }>(token, `/search?q=${encodeURIComponent(q)}`),
  profile: (token: string, id: string) =>
    call<
      ChatPerson & {
        countryCode?: string;
        coinBalance: number;
        balanceUnits: number;
        blocked: boolean;
        friendship: "self" | "none" | "incoming" | "outgoing" | "friends";
      }
    >(token, `/users/${id}`),
  friends: (token: string, q = "") => call<{users: ChatPerson[]}>(token, `/friends?q=${encodeURIComponent(q)}`),
  friendRequests: (token: string) => call<{ requests: (ChatPerson & {requestedAt: string})[] }>(token, "/friend-requests"),
  requestFriend: (token: string, id: string) => call<{status: string}>(token, `/users/${id}/friend-request`, "POST"),
  answerFriend: (token: string, id: string, accept: boolean) => call<{status: string; id?: string}>(token, `/users/${id}/friend-answer`, "POST", {accept}),
  username: (token: string, username: string) =>
    call<{ username: string | null }>(token, "/username", "PUT", { username }),
  direct: (token: string, userId: string) =>
    call<{ id: string }>(token, "/direct", "POST", { userId }),
  create: (
    token: string,
    input: {
      kind: "group" | "channel";
      title: string;
      description: string;
      visibility: "public" | "invite";
      username?: string;
    },
  ) => call<{ id: string }>(token, "/rooms", "POST", input),
  updateRoom: (
    token: string,
    id: string,
    input: { title: string; description: string; avatarAttachmentId?: string; username?: string; visibility?: "public" | "invite" },
  ) => call<{ ok: boolean }>(token, `/${id}`, "PATCH", input),
  join: (token: string, code: string) =>
    call<{ id: string }>(token, "/join", "POST", { code }),
  listen: (token: string, id: string) => call<{ok: boolean}>(token, `/messages/${id}/listen`, "POST"),
  messages: (token: string, id: string, before?: number, q?: string) =>
    call<{ items: ChatItem[]; before: number | null; pinned?: {id: string; seq: number; text: string; hasAttachments: boolean}[] }>(
      token,
      `/${id}/messages?${new URLSearchParams({ ...(before ? { before: String(before) } : {}), ...(q ? { q } : {}) })}`,
    ),
  send: (
    token: string,
    id: string,
    input: {
      clientId: string;
      text?: string;
      attachmentIds?: string[];
      replyTo?: string;
      forwardId?: string;
    },
  ) =>
    call<{ id: string; seq: number }>(token, `/${id}/messages`, "POST", input),
  change: (
    token: string,
    id: string,
    action: {
      text?: string;
      remove?: "self" | "all";
      emoji?: string;
      pinned?: boolean;
      report?: string;
    },
  ) => call<{ ok: boolean }>(token, `/messages/${id}`, "PATCH", action),
  member: (
    token: string,
    id: string,
    input: {
      muted?: boolean;
      pinned?: boolean;
      readSeq?: number;
      leave?: boolean;
      targetId?: string;
      role?: "admin" | "member";
      canEditInfo?: boolean;
      remove?: boolean;
    },
  ) =>
    call<{ ok: boolean; readIds?: string[] }>(
      token,
      `/${id}/member`,
      "PATCH",
      input,
    ),
  addMember: (token: string, id: string, userId: string) =>
    call<{ ok: boolean }>(token, `/${id}/members`, "POST", { userId }),
  members: (token: string, id: string) =>
    call<{
      count: number;
      members: (ChatPerson & { role: string; canEditInfo: boolean })[];
    }>(token, `/${id}/members`),
  upload: (token: string, file: ChatDraftFile) =>
    call<{ id: string; name: string; kind: string; size: number }>(
      token,
      "/attachments",
      "POST",
      file,
    ),
  block: (token: string, id: string, blocked: boolean) =>
    call<{ blocked: boolean }>(token, `/users/${id}/block`, "PUT", { blocked }),
};
// Keep a still-valid media ticket across polling responses. Tickets are scoped
// to both user and session; a different attachment or session gets a new entry.
const mediaTickets = new Map<string, { url: string; expires: number }>();
export function chatMediaUrl(value: string) {
  if (value.startsWith("/api/v1/chat/media/")) {
    const parsed = new URL(value, "http://chat.local");
    const expires = Number(parsed.searchParams.get("e"));
    const key = `${parsed.pathname}:${parsed.searchParams.get("u")}:${parsed.searchParams.get("s")}`;
    const previous = mediaTickets.get(key);
    if (previous && previous.expires > Date.now() + 30_000) {
      value = previous.url;
    } else if (Number.isFinite(expires) && expires > Date.now() + 30_000) {
      if (mediaTickets.size >= 500) mediaTickets.delete(mediaTickets.keys().next().value!);
      mediaTickets.set(key, { url: value, expires });
    }
  }
  if (!value.startsWith("/")) return value;
  return API_URL.startsWith("/")
    ? value
    : new URL(value, new URL(API_URL).origin).toString();
}

export const chatAdminApi = {
  reports: (token: string) =>
    request<{
      reports: {
        _id: string;
        userId: { name: string };
        messageId: { _id: string; text: string } | null;
        reason: string;
        createdAt: string;
        resolvedAt?: string;
      }[];
    }>("/admin/chat-reports", { token }),
  resolve: (token: string, id: string, removeMessage: boolean) =>
    request<{ ok: boolean }>(`/admin/chat-reports/${id}`, {
      token,
      method: "PATCH",
      body: JSON.stringify({ removeMessage }),
    }),
};
