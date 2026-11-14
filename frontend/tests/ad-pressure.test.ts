import { expect, it } from "vitest";
import { createAdPressure, FORCED_AD_INTERVAL_MS } from "../src/lib/ad-pressure";

it("spaces forced ads across formats and grants a startup grace period", async () => {
  let time = 0;
  const pressure = createAdPressure(() => time);
  expect(await pressure.forced(async () => true)).toBe(false);
  time += FORCED_AD_INTERVAL_MS;
  expect(await pressure.forced(async () => true)).toBe(true);
  expect(await pressure.forced(async () => true)).toBe(false);
  time += FORCED_AD_INTERVAL_MS;
  expect(await pressure.forced(async () => true)).toBe(true);
});

it("keeps reward receipts intact and prevents forced ads during and after rewards", async () => {
  let time = 0;
  const pressure = createAdPressure(() => time);
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const receipt = { completed: true, proof: "receipt" };
  const reward = pressure.rewarded(async () => { await pending; return receipt; });
  time += FORCED_AD_INTERVAL_MS * 2;
  expect(await pressure.forced(async () => true)).toBe(false);
  finish();
  expect(await reward).toBe(receipt);
  expect(await pressure.forced(async () => true)).toBe(false);
  time += FORCED_AD_INTERVAL_MS;
  expect(await pressure.forced(async () => true)).toBe(true);
});

it("releases failed requests without creating an immediate retry loop", async () => {
  let time = 0;
  const pressure = createAdPressure(() => time);
  time += FORCED_AD_INTERVAL_MS;
  await expect(pressure.forced(async () => { throw new Error("offline"); })).rejects.toThrow("offline");
  expect(await pressure.forced(async () => true)).toBe(false);
  time += FORCED_AD_INTERVAL_MS;
  expect(await pressure.forced(async () => true)).toBe(true);
});


it("allows one startup attempt without removing the shared cooldown", async () => {
  const pressure = createAdPressure(() => 0);
  expect(await pressure.forced(async () => true, true)).toBe(true);
  expect(await pressure.forced(async () => true, true)).toBe(false);
  expect(await pressure.forced(async () => true)).toBe(false);
});

it("does not bypass an active reward with a startup ad", async () => {
  const pressure = createAdPressure(() => 0);
  await pressure.rewarded(async () => true);
  expect(await pressure.forced(async () => true, true)).toBe(false);
});

it("allows each requested boundary after a reward without the time cooldown", async () => {
  const pressure = createAdPressure(() => 0);
  await pressure.rewarded(async () => true);
  expect(await pressure.forced(async () => true, false, { atBoundary: true })).toBe(true);
  expect(await pressure.forced(async () => true, false, { atBoundary: true })).toBe(true);
  expect(await pressure.forced(async () => true)).toBe(false);
});
it("never overlaps a boundary ad with a reward or another fullscreen ad", async () => {
  const pressure = createAdPressure(() => 0);
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const reward = pressure.rewarded(async () => { await pending; });
  expect(await pressure.forced(async () => true, false, { atBoundary: true })).toBe(false);
  finish(); await reward;
  let close!: () => void;
  const ad = pressure.forced(() => new Promise<boolean>(resolve => { close = () => resolve(true); }), false, { atBoundary: true });
  expect(await pressure.forced(async () => true, false, { atBoundary: true })).toBe(false);
  close(); await ad;
});
