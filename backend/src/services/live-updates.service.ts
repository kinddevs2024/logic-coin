import type { Server } from "node:http";
import { Types } from "mongoose";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { API_PREFIX } from "../config/constants.js";
import { ApiError } from "../lib/api-error.js";
import { isNativeAppClient } from "../lib/native-client.js";
import { isAccessSessionActive, verifyAccessToken } from "./token.service.js";

const AUTH_TIMEOUT_MS = 10_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const clients = new Set<WebSocket>();
const identities = new Map<WebSocket, { userId: Types.ObjectId; token: string }>();
const limits = new Map<string, { start: number; count: number }>();

async function snapshot(userId: Types.ObjectId) {
  const { executeLiveCommand } = await import("./live-command.service.js");
  const today = await executeLiveCommand(userId, "today", {});
  const reward = await executeLiveCommand(userId, "pendingReward", {});
  return { today, reward };
}

async function pushSnapshot(socket: WebSocket) {
  const identity = identities.get(socket);
  if (!identity) return;
  try {
    verifyAccessToken(identity.token);
    send(socket, { type: "state", ...await snapshot(identity.userId) });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) socket.close(4401, "Session expired");
  }
}

function send(socket: WebSocket, payload: Record<string, unknown>): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function textFromRawData(data: RawData): string {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return Buffer.from(data as Uint8Array).toString("utf8");
}

/** Attach the authenticated events endpoint to the API HTTP server. */
export function attachLiveUpdates(server: Server): () => void {
  const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 2_048 });
  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname !== `${API_PREFIX}/events`) {
      socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      websocketServer.emit("connection", websocket, request);
    });
  });

  websocketServer.on("connection", (websocket, request) => {
    const nativeClient = isNativeAppClient(request.headers);
    let authenticated = false;
    let authInProgress = false;
    let alive = true;
    const authTimeout = setTimeout(() => websocket.close(4401, "Authentication required"), AUTH_TIMEOUT_MS);
    websocket.on("pong", () => { alive = true; });
    websocket.on("message", (raw) => {
      if (authenticated) {
        void (async () => {
          let id: string | undefined;
          try {
            const message = JSON.parse(textFromRawData(raw));
            if (typeof message.id !== "string" || message.id.length > 100 || typeof message.method !== "string") return;
            id = message.id;
            const identity = identities.get(websocket)!;
            const payload = verifyAccessToken(identity.token);
            if (!await isAccessSessionActive(identity.userId, payload.sid)) throw new ApiError(401, "session_expired", "Session expired");
            const key = identity.userId.toString();
            let limit = limits.get(key);
            if (!limit || Date.now() - limit.start >= 60_000) {
              limit = { start: Date.now(), count: 0 };
              limits.set(key, limit);
            }
            if (++limit.count > 30) throw new Error("Too many commands; try again later");
            const { executeLiveCommand } = await import("./live-command.service.js");
            const data = await executeLiveCommand(identity.userId, message.method, message.input ?? {}, nativeClient);
            // A committed mutation is acknowledged even if refreshing its view fails.
            let state;
            if (!["today", "pendingReward"].includes(message.method)) {
              try { state = await snapshot(identity.userId); } catch { /* preserve acknowledgement */ }
            }
            send(websocket, { type: "response", id, data, ...(state ? { state } : {}) });
            if (state) for (const [other, otherIdentity] of identities) {
              if (other !== websocket && otherIdentity.userId.equals(identity.userId)) send(other, { type: "state", ...state });
            }
          } catch (error) {
            send(websocket, { type: "response", id, error: { message: error instanceof Error ? error.message : "Command failed", status: error instanceof ApiError ? error.statusCode : 400 } });
          }
        })();
        return;
      }
      if (authInProgress) return;
      let message: { type?: unknown; token?: unknown };
      try {
        message = JSON.parse(textFromRawData(raw)) as { type?: unknown; token?: unknown };
      } catch {
        websocket.close(4400, "Invalid message");
        return;
      }
      if (message.type !== "authenticate" || typeof message.token !== "string") {
        websocket.close(4401, "Authentication required");
        return;
      }
      authInProgress = true;
      void (async () => {
        try {
          const payload = verifyAccessToken(message.token as string);
          if (!Types.ObjectId.isValid(payload.sub) || !Types.ObjectId.isValid(payload.sid)) {
            websocket.close(4401, "Invalid access token");
            return;
          }
          if (!(await isAccessSessionActive(new Types.ObjectId(payload.sub), payload.sid))) {
            websocket.close(4401, "Access session is inactive");
            return;
          }
          if (websocket.readyState !== WebSocket.OPEN) return;
          authenticated = true;
          clearTimeout(authTimeout);
          clients.add(websocket);
          identities.set(websocket, { userId: new Types.ObjectId(payload.sub), token: message.token as string });
          send(websocket, { type: "authenticated" });
        } catch {
          websocket.close(4401, "Invalid access token");
        }
      })();
    });

    const cleanup = () => {
      clearTimeout(authTimeout);
      clearInterval(heartbeat);
      clients.delete(websocket);
      identities.delete(websocket);
    };
    websocket.on("close", cleanup);
    websocket.on("error", cleanup);
    const heartbeat = setInterval(() => {
      if (websocket.readyState !== WebSocket.OPEN) {
        clearInterval(heartbeat);
      } else if (!alive) {
        websocket.terminate();
        clearInterval(heartbeat);
      } else {
        const identity = identities.get(websocket);
        if (identity) {
          try { verifyAccessToken(identity.token); }
          catch { websocket.close(4401, "Session expired"); return; }
        }
        alive = false;
        websocket.ping();
      }
    }, HEARTBEAT_INTERVAL_MS);
  });

  return () => {
    for (const client of clients) client.close(1001, "Server shutting down");
    clients.clear();
    identities.clear();
    limits.clear();
    websocketServer.close();
  };
}

export function broadcastDailyChallengeUpdate(_dayKey: string, _revision?: string | null): void {
  for (const client of clients) void pushSnapshot(client);
}
