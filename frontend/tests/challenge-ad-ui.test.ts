import { describe, it, expect } from "vitest";
import { offerDelay, OFFER_COOLDOWN_MS } from "../src/lib/challenge-ad-offer";
describe("offer cooldown scheduling", () => {
  const now = 1700000000000;
  it("shows immediately when eligible with no previous dismissal", () => {
    expect(offerDelay(new Date(now).toISOString(), new Date(now).toISOString(), 0, now)).toBe(0);
  });
  it("uses server time even with an incorrect device clock", () => {
    expect(offerDelay(new Date(now + OFFER_COOLDOWN_MS).toISOString(), new Date(now).toISOString(), 0, now + 900000)).toBe(300000);
  });
  it("honors dismissal across reentry and expires at five minutes", () => {
    const date = new Date(now).toISOString();
    expect(offerDelay(date, date, now + OFFER_COOLDOWN_MS, now)).toBe(300000);
    expect(offerDelay(date, date, now + OFFER_COOLDOWN_MS, now + 300000)).toBe(0);
  });
});
