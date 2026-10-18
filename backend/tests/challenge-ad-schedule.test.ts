import { describe, expect, it } from "vitest";
import { CHALLENGE_AD_DAILY_LIMIT, nextChallengeAdDeadline } from "../src/lib/challenge-ad-schedule.js";
describe("seven daily ad offers", () => {
  it("uses increasing intervals independent of the floating home gift", () => {
    const now = new Date("2026-10-18T02:00:00Z");
    expect(CHALLENGE_AD_DAILY_LIMIT).toBe(7);
    for (const [count, minutes] of [5, 30, 60, 120, 180, 240, 300].entries()) {
      expect(nextChallengeAdDeadline(now, count).getTime() - now.getTime()).toBe(minutes * 60_000);
    }
  });
  it("never schedules after the Tashkent day reset", () => {
    const now = new Date("2026-10-18T18:59:00Z");
    expect(nextChallengeAdDeadline(now, 6).toISOString()).toBe("2026-10-18T19:00:00.000Z");
    expect(nextChallengeAdDeadline(now, 7).toISOString()).toBe("2026-10-18T19:00:00.000Z");
  });
});
