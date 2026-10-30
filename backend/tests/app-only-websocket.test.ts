import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
const mocks = vi.hoisted(() => ({ start: vi.fn(async () => ({ accepted: true })), complete: vi.fn(async () => ({})), practice: vi.fn(async () => ({})), double: vi.fn(async () => ({})) }));
vi.mock("../src/services/token.service.js", () => ({ verifyAccessToken: () => ({ sub: "507f1f77bcf86cd799439011", sid: "507f1f77bcf86cd799439012" }), isAccessSessionActive: async () => true }));
vi.mock("../src/services/challenge-attempt.service.js", () => ({ startChallengeAttempt: mocks.start, completeChallengeAttempt: mocks.complete, completePracticeAttempt: mocks.practice, doubleChallengeCoins: mocks.double }));
vi.mock("../src/services/daily-challenge.service.js", () => ({ getTodayChallengeOverview: async () => ({ games: [] }) }));
vi.mock("../src/services/contest.service.js", () => ({ getPendingContestReward: async () => null, claimContestReward: async () => ({}) }));
import { attachLiveUpdates } from "../src/services/live-updates.service.js";
describe("shared browser and APK commands over real WebSocket transport", () => {
  const server = createServer(); let stop: () => void; let url: string;
  beforeAll(async () => {
    stop = attachLiveUpdates(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw Error("No port");
    url = `ws://127.0.0.1:${address.port}/api/v1/events`;
  });
  afterAll(async () => { stop(); await new Promise<void>(resolve => server.close(() => resolve())); });
  async function command(ua: string, method: string, input: unknown) {
    const client = new WebSocket(url, { headers: { "User-Agent": ua, Origin: "https://logic-coin.online" } });
    try {
      await new Promise<void>((resolve, reject) => { client.once("open", resolve); client.once("error", reject); });
      const auth = new Promise(resolve => client.once("message", resolve));
      client.send(JSON.stringify({ type: "authenticate", token: "test-only" })); await auth;
      const reply = new Promise<any>(resolve => client.once("message", data => resolve(JSON.parse(data.toString()))));
      client.send(JSON.stringify({ id: "test", method, input })); return await reply;
    } finally { client.terminate(); }
  }
  it.each(["start", "complete", "double"])("allows authenticated browser %s", async method => {
    vi.clearAllMocks();
    const input = method === "double" ? { scope: "game" } : method === "start" ? { gameKey: "tetris" } : { gameKey: "tetris", score: 10 };
    const result = await command("Mozilla/5.0", method, input);
    expect(result.error).toBeUndefined();
    const service = method === "start" ? mocks.start : method === "complete" ? mocks.complete : mocks.double;
    expect(service).toHaveBeenCalledOnce();
  });
  it("keeps browser reads and practice working", async () => {
    expect((await command("Mozilla/5.0", "today", {})).data).toEqual({ games: [] });
    expect((await command("Mozilla/5.0", "completePractice", { gameKey: "tetris", score: 10 })).error).toBeUndefined();
  });
  it("allows installed APK without a new version or new headers", async () => {
    vi.clearAllMocks();
    expect((await command("okhttp/4.12.0", "start", { gameKey: "tetris" })).data).toEqual({ accepted: true });
    expect(mocks.start).toHaveBeenCalledOnce();
  });
  it("still rejects a browser command without authentication", async () => {
    vi.clearAllMocks();
    const client = new WebSocket(url, { headers: { Origin: "https://logic-coin.online" } });
    try {
      await new Promise<void>((resolve, reject) => { client.once("open", resolve); client.once("error", reject); });
      const closed = new Promise<number>(resolve => client.once("close", code => resolve(code)));
      client.send(JSON.stringify({ id: "unauthenticated", method: "start", input: { gameKey: "tetris" } }));
      expect(await closed).toBe(4401);
      expect(mocks.start).not.toHaveBeenCalled();
    } finally { client.terminate(); }
  });
});
