import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ aggregate: vi.fn(), bulkWrite: vi.fn(), distinct: vi.fn() }));
vi.mock("../src/models/NotificationEvent.js", () => ({ NotificationEvent: { aggregate: m.aggregate } }));
vi.mock("../src/models/NotificationRead.js", () => ({ NotificationRead: { collection: { name: "notificationreads" }, bulkWrite: m.bulkWrite } }));
vi.mock("../src/models/GiftItem.js", () => ({ GiftItem: { collection: { name: "giftitems" } } }));
vi.mock("../src/models/DailyContestResult.js", () => ({ DailyContestResult: { collection: { name: "dailycontestresults" }, distinct: m.distinct } }));
vi.mock("../src/models/User.js", () => ({ User: { findById: () => ({ select: () => ({ lean: async () => ({ createdAt: new Date("2026-01-01") }) }) }) } }));
import { listInbox, markInboxRead } from "../src/services/inbox.service.js";
describe("notification inbox", () => {
  const userId = new Types.ObjectId();
  beforeEach(() => { vi.resetAllMocks(); m.distinct.mockResolvedValue(["2026-09-19"]); m.aggregate.mockResolvedValue([]); });
  it("restricts all sources and read receipts to the authenticated audience", async () => {
    await listInbox(userId, false);
    const stages = m.aggregate.mock.calls[0]![0];
    expect(stages[0].$match.$or).toContainEqual({ audience: "specific_users", "payload.userIds": userId.toString() });
    expect(stages[2].$unionWith.pipeline[0]).toEqual({ $match: { userId } });
    expect(stages[3].$unionWith.pipeline[0]).toEqual({ $match: { userId } });
    expect(stages).toContainEqual({ $match: { read: false } });
  });
  it("history includes read notifications and paginates without losing equal timestamps", async () => {
    const date = "2026-09-19T00:00:00.000Z";
    m.aggregate.mockResolvedValue(Array.from({ length: 31 }, (_, i) => ({ id: `gift:${i}`, createdAt: new Date(date), read: true })));
    const page = await listInbox(userId, true, { date, id: "gift:cursor" });
    expect(page.items).toHaveLength(30);
    expect(page.next).toEqual({ date, id: "gift:29" });
    const stages = m.aggregate.mock.calls[0]![0];
    expect(stages).not.toContainEqual({ $match: { read: false } });
    expect(stages).toContainEqual({ $match: { $or: [{ createdAt: { $lt: new Date(date) } }, { createdAt: new Date(date), id: { $lt: "gift:cursor" } }] } });
  });
  it("does not create read receipts for another user's notification", async () => {
    await expect(markInboxRead(userId, ["gift:unowned"])).resolves.toEqual({ marked: 0 });
    expect(m.bulkWrite).not.toHaveBeenCalled();
  });
  it("marks only owned IDs with idempotent upserts", async () => {
    m.aggregate.mockResolvedValue([{ id: "gift:owned" }]);
    await markInboxRead(userId, ["gift:owned", "gift:unowned"]);
    const writes = m.bulkWrite.mock.calls[0]![0];
    expect(writes).toHaveLength(1);
    expect(writes[0].updateOne.filter).toEqual({ userId, notificationId: "gift:owned" });
    expect(writes[0].updateOne.upsert).toBe(true);
  });
});
