import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
const mocks = vi.hoisted(() => ({ start: vi.fn(async () => ({ accepted: true })), complete: vi.fn(async () => ({})), practice: vi.fn(async () => ({})), double: vi.fn(async () => ({})) }));
vi.mock("../src/services/token.service.js", () => ({ verifyAccessToken: () => ({ sub: "507f1f77bcf86cd799439011", sid: "507f1f77bcf86cd799439012" }), isAccessSessionActive: async () => true }));
vi.mock("../src/services/challenge-attempt.service.js", () => ({ startChallengeAttempt: mocks.start, completeChallengeAttempt: mocks.complete, completePracticeAttempt: mocks.practice, doubleChallengeCoins: mocks.double }));
vi.mock("../src/services/daily-challenge.service.js", () => ({ getTodayChallengeOverview: async () => ({ games: [] }) }));
vi.mock("../src/services/contest.service.js", () => ({ getPendingContestReward: async () => null, claimContestReward: async () => ({}) }));
import { attachLiveUpdates } from "../src/services/live-updates.service.js";
describe("app-only commands over real WebSocket transport", () => {
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
  it.each(["start", "complete", "double"])("rejects browser %s", async method => {
    const result = await command("Mozilla/5.0", method, { gameKey: "tetris", score: 10 });
    expect(result.error.status).toBe(403);
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.double).not.toHaveBeenCalled();
  });
  it("keeps browser reads and practice working", async () => {
    expect((await command("Mozilla/5.0", "today", {})).data).toEqual({ games: [] });
    expect((await command("Mozilla/5.0", "completePractice", { gameKey: "tetris", score: 10 })).error).toBeUndefined();
  });
  it("allows installed APK without a new version or new headers", async () => {
    expect((await command("okhttp/4.12.0", "start", { gameKey: "tetris" })).data).toEqual({ accepted: true });
    expect(mocks.start).toHaveBeenCalledOnce();
  });
});
