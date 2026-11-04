import { API_URL, authenticatedRequest as request } from "./api";
export type ChatPerson = {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  referralCode?: string;
};
export type ChatRoom = {
  id: string;
  kind: "direct" | "support" | "group" | "channel";
  systemKey: "news" | "community" | null;
  title: string;
  description: string;
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
  reactions: { userId: string; emoji: string }[];
  own: boolean;
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
  list: (token: string) => call<{ chats: ChatRoom[] }>(token, "/"),
  search: (token: string, q: string) =>
    call<{
      users: ChatPerson[];
      rooms: {
        id: string;
        title: string;
        kind: string;
        description: string;
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
      }
    >(token, `/users/${id}`),
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
    },
  ) => call<{ id: string }>(token, "/rooms", "POST", input),
  updateRoom: (
    token: string,
    id: string,
    input: { title: string; description: string; avatarAttachmentId?: string },
  ) => call<{ ok: boolean }>(token, `/${id}`, "PATCH", input),
  join: (token: string, code: string) =>
    call<{ id: string }>(token, "/join", "POST", { code }),
  messages: (token: string, id: string, before?: number, q?: string) =>
    call<{ items: ChatItem[]; before: number | null }>(
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
export function chatMediaUrl(value: string) {
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
