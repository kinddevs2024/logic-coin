import { describe, expect, it } from "vitest";
import { beforeReadCutoff, inboxNotificationIds, unseenInboxItems } from "../src/lib/inbox-notification-tray";

const id = "1234567890abcdef12345678";
describe("OS notification / inbox identity", () => {
  it("maps gift pushes to the gift inbox row instead of the excluded outbox event", () => {
    expect(inboxNotificationIds({ inboxId: `gift:${id}`, eventId: id })).toEqual([`gift:${id}`]);
    expect(inboxNotificationIds({ eventId: id })).toEqual([`event:${id}`]);
    expect(inboxNotificationIds({ inboxId: "an arbitrary item" })).toEqual([]);
  });
  it("keeps notifications created after the read-all transaction cutoff", () => {
    const cutoff = "2026-10-18T08:00:00.000Z";
    expect(beforeReadCutoff("2026-10-18T07:59:59.000Z", 0, cutoff)).toBe(true);
    expect(beforeReadCutoff("2026-10-18T08:00:01.000Z", 0, cutoff)).toBe(false);
    expect(beforeReadCutoff(undefined, Date.parse("2026-10-18T08:00:01.000Z"), cutoff)).toBe(false);
    expect(beforeReadCutoff("invalid", 0, cutoff)).toBe(false);
  });
  it("excludes read, malformed and previously delivered items", () => {
    const fresh = { id: `event:${id}`, createdAt: "2026-10-18T08:00:00Z", read: false };
    expect(unseenInboxItems([fresh, { ...fresh, id: "invalid" }, { ...fresh, read: true }], new Set())).toEqual([fresh]);
    expect(unseenInboxItems([fresh], new Set([fresh.id]))).toEqual([]);
  });
});
