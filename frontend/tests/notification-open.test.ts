import { expect, it } from "vitest";
import { markNotificationOpen, notificationOpenRecently } from "../src/lib/notification-open";
it("protects notification navigation for a short window without disabling later ads", () => {
  expect(notificationOpenRecently(1000)).toBe(false); markNotificationOpen(1000);
  expect(notificationOpenRecently(1001)).toBe(true); expect(notificationOpenRecently(16000)).toBe(false); expect(notificationOpenRecently(500)).toBe(false);
});
