import { describe, expect, it } from "vitest";
import { createRegistrationReferralTracker } from "../src/lib/registration-referral";

function storage() {
  const values = new Map<string, string>();
  return { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); } };
}
describe("pending registration referral", () => {
  it("captures a warm APK invite after an organic first launch", async () => {
    const tracker = createRegistrationReferralTracker(storage());
    await tracker.initialize(null);
    await tracker.capture("logiccoin://invite/LCFIRST");
    expect(await tracker.get()).toBe("LCFIRST");
  });
  it("keeps the first inviter through Google, Telegram and process restart", async () => {
    const disk = storage();
    const tracker = createRegistrationReferralTracker(disk);
    await tracker.initialize(null);
    await tracker.capture("https://logic-coin.online/invite/LCFIRST");
    await tracker.capture("logiccoin://login?telegram_token=example");
    await tracker.capture("/invite/LCSECOND");
    const restarted = createRegistrationReferralTracker(disk);
    await restarted.initialize(null);
    expect(await restarted.get()).toBe("LCFIRST");
  });
  it("serializes an invite write before auth reads it", async () => {
    const tracker = createRegistrationReferralTracker(storage());
    await tracker.initialize(null);
    const writing = tracker.capture("/login?ref=LCFIRST");
    expect(await tracker.get()).toBe("LCFIRST");
    await writing;
  });
  it("does not reuse a consumed legacy invitation for a different account", async () => {
    const disk = storage();
    const tracker = createRegistrationReferralTracker(disk);
    await tracker.initialize("LCOLD");
    await tracker.clear();
    const restarted = createRegistrationReferralTracker(disk);
    await restarted.initialize("LCOLD");
    expect(await restarted.get()).toBeUndefined();
    await restarted.capture("/invite/LCNEW");
    expect(await restarted.get()).toBe("LCNEW");
  });
  it("ignores invalid URLs and survives inaccessible storage", async () => {
    const tracker = createRegistrationReferralTracker({ getItem: async () => { throw Error(); }, setItem: async () => { throw Error(); } });
    await tracker.initialize(null);
    await tracker.capture("/invite/%ZZ");
    expect(await tracker.get()).toBeUndefined();
    await tracker.capture("/invite/LCFIRST");
    expect(await tracker.get()).toBe("LCFIRST");
  });
});
