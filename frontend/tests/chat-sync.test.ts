import { expect, it, vi } from "vitest";
import { catchUpChatHead, createSerialChatRefresh } from "../src/lib/chat-sync";
const rows = (start: number, end: number) => Array.from({length: end-start+1}, (_, i) => ({id: String(start+i), seq: start+i}));
it("does not cancel a slow refresh when a burst of messages arrives", async () => {
  let release!: () => void;
  const run = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; })).mockResolvedValue(undefined);
  const refresh = createSerialChatRefresh(run);
  const first = refresh();
  for (let i=0;i<50;i++) void refresh();
  expect(run).toHaveBeenCalledTimes(1);
  release();
  await first;
  expect(run).toHaveBeenCalledTimes(2);
});
it("recovers more than 50 missed messages without losing the old head", async () => {
  const fetch = vi.fn(async (before = 101) => ({items: rows(Math.max(1,before-40), before-1), before: before > 41 ? before-40 : null}));
  const result = await catchUpChatHead(fetch, {items: rows(1,20), before: null});
  expect(result.items.map(item => item.seq)).toEqual(rows(1,100).map(item => item.seq));
  expect(fetch.mock.calls).toEqual([[], [61], [21]]);
  expect(result.before).toBeNull();
});
it("does not resurrect messages removed from the fetched range", async () => {
  const result = await catchUpChatHead(async () => ({items: [{id:"1",seq:1}, {id:"3",seq:3}], before:null}), {items: rows(1,3),before:null});
  expect(result.items.map(item => item.seq)).toEqual([1,3]);
});
it("bounds the live head and keeps an older history cursor", async () => {
  const result = await catchUpChatHead(async (before = 411) => ({items: rows(before === 411 ? 400 : 360,before-1), before: before === 411 ? 400 : 360}), {items:rows(1,399),before:null});
  expect(result.items).toHaveLength(400);
  expect(result.before).toBe(11);
});
it("releases a failed refresh so reconnect can retry", async () => {
  const run = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  const refresh = createSerialChatRefresh(run);
  await expect(refresh()).rejects.toThrow("offline");
  await refresh();
  expect(run).toHaveBeenCalledTimes(2);
});
