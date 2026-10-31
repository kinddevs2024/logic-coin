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
