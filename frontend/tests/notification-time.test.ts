import { describe, expect, it } from "vitest";
import { formatNotificationTime } from "../src/lib/notification-time";
const now = new Date(2026, 8, 20, 23, 0);
const fmt = (day: number, hour: number, uses24hourClock: boolean) => formatNotificationTime(new Date(2026, 8, day, hour, 24, 57).toISOString(), { now, uses24hourClock, language: "ru" });
describe("notification timestamp", () => {
  it("shows time only today without seconds", () => { expect(fmt(20, 22, false)).toBe("10:24 PM"); expect(fmt(20, 22, true)).toBe("22:24"); });
  it("uses correct midnight and noon", () => { expect(fmt(20, 0, false)).toBe("12:24 AM"); expect(fmt(20, 12, false)).toBe("12:24 PM"); expect(fmt(20, 0, true)).toBe("00:24"); });
  it("labels only yesterday and uses a date for two days ago", () => {
    expect(fmt(19, 22, true)).toBe("Вчера, 22:24");
    expect(fmt(18, 9, false)).toBe("18 сентября, 9:24 AM");
    expect(formatNotificationTime(new Date(2026, 8, 18, 9, 24).toISOString(), { now, language: "en", uses24hourClock: false })).toBe("18 September, 9:24 AM");
  });
  it("formats older dates and handles invalid timestamps", () => { expect(fmt(12, 21, false)).toBe("12 сентября, 9:24 PM"); expect(formatNotificationTime("bad")).toBe(""); });
  it("handles month boundaries and keeps English dates day first", () => {
    expect(formatNotificationTime(new Date(2026, 7, 31, 23, 59).toISOString(), { now: new Date(2026, 8, 1, 0, 1), language: "en", uses24hourClock: false })).toBe("Yesterday, 11:59 PM");
  });
});
