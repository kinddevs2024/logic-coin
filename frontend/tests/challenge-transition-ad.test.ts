import { expect, it } from "vitest";
import { consumeChallengeAdEntry, prepareChallengeAdEntry } from "../src/lib/challenge-transition-ad";
it("never duplicates the Next ad when the following game mounts", () => {
  prepareChallengeAdEntry("2026-11-08", "one-second");
  expect(consumeChallengeAdEntry("2026-11-08", "one-second")).toBe(true);
  expect(consumeChallengeAdEntry("2026-11-08", "one-second")).toBe(false);
});
it("does not skip another game or carry a skip into a different day", () => {
  prepareChallengeAdEntry("2026-11-08", "one-second");
  expect(consumeChallengeAdEntry("2026-11-08", "color")).toBe(false);
  prepareChallengeAdEntry("2026-11-08", "one-second");
  expect(consumeChallengeAdEntry("2026-11-09", "one-second")).toBe(false);
});
