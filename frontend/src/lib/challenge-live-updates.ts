import { API_URL, refreshAccessToken } from "@/lib/api";
import type { TodayChallenges, PendingContestReward } from "@/types";
export type LiveState = { today?: TodayChallenges; reward?: PendingContestReward | null };

type Connection = {
  socket: WebSocket | null;
  listeners: Set<(state: LiveState) => void>;
  pending: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; message: string; sent: boolean }>;
  retryTimer: ReturnType<typeof setTimeout> | null;
  retryAttempt: number;
  hasConnected: boolean;
  authenticated: boolean;
};

const connections = new Map<string, Connection>();

function websocketUrl(): string {
  const apiUrl = API_URL.replace(/\/+$/, "");
  if (apiUrl.startsWith("/")) {
    if (typeof window === "undefined") throw new Error("WebSocket needs a browser origin");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${apiUrl}/events`;
  }
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/events`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function notify(connection: Connection, state: LiveState): void {
  for (const listener of connection.listeners) listener(state);
}

function scheduleReconnect(token: string, connection: Connection): void {
  if (connection.listeners.size === 0 || connection.retryTimer) return;
  const delay = Math.min(30_000, 1_000 * 2 ** connection.retryAttempt);
  connection.retryAttempt += 1;
  connection.retryTimer = setTimeout(() => {
    connection.retryTimer = null;
    connect(token, connection);
  }, delay);
}

function connect(token: string, connection: Connection): void {
  if (connection.listeners.size === 0 || connection.socket) return;
  let socket: WebSocket;
  try {
    socket = new WebSocket(websocketUrl());
  } catch {
    scheduleReconnect(token, connection);
    return;
  }
  connection.socket = socket;
  connection.authenticated = false;
  socket.onopen = () => socket.send(JSON.stringify({ type: "authenticate", token }));
  socket.onmessage = (event) => {
    let message: { type?: string; id?: string; data?: unknown; error?: { message: string; status?: number }; state?: LiveState } & LiveState;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (message.type === "authenticated") {
      const reconnected = connection.hasConnected;
      connection.hasConnected = true;
      connection.authenticated = true;
      connection.retryAttempt = 0;
      for (const pending of connection.pending.values()) {
        if (!pending.sent) { pending.sent = true; socket.send(pending.message); }
      }
      if (reconnected) {
        void liveCommand<TodayChallenges>(token, "today").then(today => notify(connection, { today })).catch(() => {});
        void liveCommand<PendingContestReward | null>(token, "pendingReward").then(reward => notify(connection, { reward })).catch(() => {});
      }
    } else if (message.type === "state" && connection.authenticated) {
      notify(connection, message);
    } else if (message.type === "response" && message.id) {
      if (message.state) notify(connection, message.state);
      const pending = connection.pending.get(message.id);
      if (pending) {
        clearTimeout(pending.timer);
        connection.pending.delete(message.id);
        if (message.error) pending.reject(Object.assign(new Error(message.error.message), { status: message.error.status }));
        else pending.resolve(message.data);
      }
    }
  };
  socket.onerror = () => socket.close();
  socket.onclose = (event) => {
    if (connection.socket === socket) connection.socket = null;
    connection.authenticated = false;
    for (const [id, pending] of connection.pending) {
      clearTimeout(pending.timer);
      pending.reject(Object.assign(new Error("Соединение прервано. Проверьте результат перед повтором."), { status: event.code === 4401 ? 401 : 0 }));
      connection.pending.delete(id);
    }
    if (event.code !== 4401) scheduleReconnect(token, connection);
    else if (connection.listeners.size) void refreshAccessToken(token).catch(() => {});
  };
}

/** Maintain a single authenticated live-update socket across mounted screens. */
export function subscribeToChallengeUpdates(token: string, listener: (state: LiveState) => void): () => void {
  let connection = connections.get(token);
  if (!connection) {
    connection = {
      socket: null,
      listeners: new Set(),
      pending: new Map(),
      retryTimer: null,
      retryAttempt: 0,
      hasConnected: false,
      authenticated: false,
    };
    connections.set(token, connection);
  }
  connection.listeners.add(listener);
  connect(token, connection);

  return () => {
    const current = connections.get(token);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;
    if (current.retryTimer) clearTimeout(current.retryTimer);
    current.retryTimer = null;
    current.socket?.close();
    current.socket = null;
    connections.delete(token);
  };
}

let sequence = 0;
export function liveCommand<T>(token: string, method: string, input: unknown = {}, refreshed = false): Promise<T> {
  const unsubscribe = subscribeToChallengeUpdates(token, () => {});
  const connection = connections.get(token)!;
  const id = `${Date.now()}-${++sequence}`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      connection.pending.delete(id);
      reject(new Error("Сервер не ответил. Проверьте соединение и результат операции."));
    }, 30_000);
    const message = JSON.stringify({ id, method, input });
    connection.pending.set(id, { resolve: value => resolve(value as T), reject, timer, message, sent: connection.authenticated });
    if (connection.authenticated) connection.socket!.send(message);
  }).finally(unsubscribe).catch(async (error: Error & { status?: number }) => {
    // Retry only an explicit pre-execution authentication failure, never a lost acknowledgement.
    if (error.status === 401 && !refreshed) return liveCommand<T>(await refreshAccessToken(token), method, input, true);
    throw error;
  });
}
