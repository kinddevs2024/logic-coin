import { expect, it, vi } from "vitest";
import { announceAppliedUpdate } from "../src/lib/applied-update-notice";
function setup() { let value: string | null = null; return { getItem: async () => value, setItem: async (_: string, next: string) => { value = next; } }; }
it("announces an applied update once and the next release separately", async () => {
  const storage = setup(), announce = vi.fn(() => true), update = { enabled: true, embedded: false, id: "release-one" };
  expect(await announceAppliedUpdate(update, storage, announce)).toBe(true);
  expect(await announceAppliedUpdate(update, storage, announce)).toBe(false);
  expect(await announceAppliedUpdate({ ...update, id: "release-two" }, storage, announce)).toBe(true);
  expect(announce).toHaveBeenCalledTimes(2);
});
it("does not announce a fresh APK installation or disabled updates", async () => {
  const storage = setup(), announce = vi.fn(() => true);
  for (const update of [{ enabled: true, embedded: true, id: "embedded" }, { enabled: false, embedded: false, id: "disabled" }, { enabled: true, embedded: false, id: null }]) expect(await announceAppliedUpdate(update, storage, announce)).toBe(false);
  expect(announce).not.toHaveBeenCalled();
});
it("does not consume a notice while the UI is unavailable", async () => {
  const storage = setup(), update = { enabled: true, embedded: false, id: "ready" };
  expect(await announceAppliedUpdate(update, storage, () => false)).toBe(false);
  expect(await announceAppliedUpdate(update, storage, () => true)).toBe(true);
});
