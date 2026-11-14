import { expect, it, vi } from "vitest";
import { announceUpdateMessage, createUpdateDownloadCheck, selectUpdateMessage } from "../src/lib/update-message";

function storage() { let value: string | null = null; return { getItem: async () => value, setItem: async (_: string, next: string) => { value = next; } }; }
it("prioritizes a completely downloaded update over the currently running version", () => {
  expect(selectUpdateMessage({ enabled: true, pendingId: "new", runningId: "old", embedded: false })).toEqual({ id: "new", kind: "downloaded" });
  expect(selectUpdateMessage({ enabled: true, pendingId: "new", embedded: true })).toEqual({ id: "new", kind: "downloaded" });
  expect(selectUpdateMessage({ enabled: true, runningId: "embedded", embedded: true })).toBeNull();
  expect(selectUpdateMessage({ enabled: false, pendingId: "new", embedded: false })).toBeNull();
});
it("catches up on an applied update and does not repeat a download notice after restart", async () => {
  const db = storage(), deliver = vi.fn().mockResolvedValue(true);
  expect(await announceUpdateMessage({ id: "new", kind: "downloaded" }, db, deliver)).toBe(true);
  expect(await announceUpdateMessage({ id: "new", kind: "applied" }, db, deliver)).toBe(false);
  expect(await announceUpdateMessage({ id: "next", kind: "applied" }, db, deliver)).toBe(true);
  expect(deliver).toHaveBeenCalledTimes(2);
});
it("allows retry when no message was delivered", async () => {
  const db = storage(), candidate = { id: "retry", kind: "downloaded" as const };
  expect(await announceUpdateMessage(candidate, db, async () => false)).toBe(false);
  expect(await announceUpdateMessage(candidate, db, async () => true)).toBe(true);
});
it("prevents two notification requests while storage and delivery are asynchronous", async () => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const deliver = vi.fn(async () => { await pending; return true; }), db = storage(), candidate = { id: "concurrent", kind: "downloaded" as const };
  const first = announceUpdateMessage(candidate, db, deliver);
  expect(await announceUpdateMessage(candidate, db, deliver)).toBe(false);
  finish(); await first;
  expect(deliver).toHaveBeenCalledOnce();
});
it("checks/downloads only when eligible and throttles repeated resume events", async () => {
  let time = 0;
  const api = { checkForUpdateAsync: vi.fn().mockResolvedValue({ isAvailable: true }), fetchUpdateAsync: vi.fn().mockResolvedValue({}) };
  const check = createUpdateDownloadCheck(api, () => time);
  expect(await check(() => false)).toBe(false);
  expect(api.checkForUpdateAsync).not.toHaveBeenCalled();
  expect(await check(() => true)).toBe(true);
  expect(await check(() => true)).toBe(false);
  time += 120_000;
  expect(await check(() => true)).toBe(true);
  expect(api.fetchUpdateAsync).toHaveBeenCalledTimes(2);
});
it("does not fetch absent updates or continue a fetch after entering a game", async () => {
  let eligible = true;
  const api = { checkForUpdateAsync: vi.fn(async () => { eligible = false; return { isAvailable: true }; }), fetchUpdateAsync: vi.fn() };
  expect(await createUpdateDownloadCheck(api)(() => eligible)).toBe(false);
  expect(api.fetchUpdateAsync).not.toHaveBeenCalled();
  eligible = true; api.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
  expect(await createUpdateDownloadCheck(api)(() => eligible)).toBe(false);
  expect(api.fetchUpdateAsync).not.toHaveBeenCalled();
});
