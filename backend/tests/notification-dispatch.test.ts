import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFindOneAndUpdate: vi.fn(),
  eventUpdateOne: vi.fn(),
  deviceFind: vi.fn(), readDistinct: vi.fn(), userFind: vi.fn(),
}));

vi.mock("../src/config/env.js", () => ({
  env: {
    EXPO_PUSH_API_URL: "https://exp.host/--/api/v2/push/send",
    EXPO_PUSH_ACCESS_TOKEN: undefined
  }
}));
vi.mock("../src/models/NotificationEvent.js", () => ({
  NotificationEvent: {
    findOneAndUpdate: mocks.eventFindOneAndUpdate,
    updateOne: mocks.eventUpdateOne
  }
}));
vi.mock("../src/models/Device.js", () => ({ Device: { find: mocks.deviceFind } }));
vi.mock("../src/models/NotificationRead.js", () => ({ NotificationRead: { distinct: mocks.readDistinct } }));
vi.mock("../src/models/User.js", () => ({ User: { find: mocks.userFind } }));

import { dispatchNotificationEvent } from "../src/services/notification.service.js";

describe("Expo notification dispatcher", () => {
  const eventId = new Types.ObjectId();

  beforeEach(() => {
    mocks.eventFindOneAndUpdate.mockReset();
    mocks.eventUpdateOne.mockReset();
    mocks.deviceFind.mockReset();
    mocks.readDistinct.mockResolvedValue([]);
    mocks.userFind.mockReturnValue({ select: () => ({ lean: async () => [] }) });
    mocks.eventFindOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: eventId,
        createdAt: new Date("2026-10-18T08:00:00Z"),
        status: "processing",
        targetCount: 2,
        payload: { dayKey: "2026-08-21", title: "Новый челлендж доступен" }
      })
    });
    mocks.deviceFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { pushToken: "ExpoPushToken[player_one]" },
          { pushToken: "ExponentPushToken[player_two]" }
        ])
      })
    });
    mocks.eventUpdateOne.mockResolvedValue({ matchedCount: 1 });
  });

  it("batches enabled device tokens and marks the event sent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ status: "ok" }, { status: "ok" }] })
    });
    const result = await dispatchNotificationEvent(eventId, fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const messages = JSON.parse(String(request.body)) as Array<{ to: string; data: unknown }>;
    expect(messages.map((message) => message.to)).toEqual([
      "ExpoPushToken[player_one]",
      "ExponentPushToken[player_two]"
    ]);
    expect(messages[0]?.data).toMatchObject({ inboxId: `event:${eventId}`, createdAt: "2026-10-18T08:00:00.000Z" });
    expect(result).toEqual({ status: "sent", targetCount: 2, sentCount: 2, failedCount: 0 });
    expect(mocks.eventUpdateOne).toHaveBeenCalledWith(
      { _id: eventId, status: "processing" },
      expect.objectContaining({
        $set: expect.objectContaining({ status: "sent", sentCount: 2, failedCount: 0 })
      })
    );
  });

  it("links gift delivery to the gift inbox row for tap-to-read", async () => {
    const giftId = new Types.ObjectId();
    mocks.eventFindOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({
      _id: eventId, createdAt: new Date("2026-10-18T08:00:00Z"), type: "gift_received", status: "processing",
      payload: { giftId: String(giftId), title: "Gift" },
    }) });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ status: "ok" }, { status: "ok" }] }) });
    await dispatchNotificationEvent(eventId, fetchMock as unknown as typeof fetch);
    const messages = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(messages[0].data.inboxId).toBe(`gift:${giftId}`);
  });

  it("does not dispatch notices read individually or through the read-all watermark", async () => {
    const firstUser = new Types.ObjectId(), secondUser = new Types.ObjectId();
    mocks.deviceFind.mockReturnValue({ select: () => ({ lean: async () => [
      { userId: firstUser, pushToken: "ExpoPushToken[player_one]" },
      { userId: secondUser, pushToken: "ExpoPushToken[player_two]" },
    ] }) });
    mocks.readDistinct.mockResolvedValue([firstUser]);
    mocks.userFind.mockReturnValue({ select: () => ({ lean: async () => [{ _id: secondUser }] }) });
    const fetchMock = vi.fn();
    const result = await dispatchNotificationEvent(eventId, fetchMock as unknown as typeof fetch);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "no_devices", targetCount: 0 });
    expect(mocks.readDistinct).toHaveBeenCalledWith("userId", expect.objectContaining({ notificationId: `event:${eventId}` }));
    expect(mocks.userFind).toHaveBeenCalledWith(expect.objectContaining({ $or: [{ inboxReadThrough: { $gte: new Date("2026-10-18T08:00:00Z") } }] }));
  });

  it("records failed delivery without undoing the published challenge", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    const result = await dispatchNotificationEvent(eventId, fetchMock as unknown as typeof fetch);
    expect(result).toEqual({ status: "failed", targetCount: 2, sentCount: 0, failedCount: 2 });
    expect(mocks.eventUpdateOne).toHaveBeenCalledWith(
      { _id: eventId, status: "processing" },
      expect.objectContaining({
        $set: expect.objectContaining({ status: "failed", failedCount: 2 })
      })
    );
  });
});
