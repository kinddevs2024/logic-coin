import { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventFindOneAndUpdate: vi.fn(),
  eventUpdateOne: vi.fn(),
  deviceFind: vi.fn()
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

import { dispatchNotificationEvent } from "../src/services/notification.service.js";

describe("Expo notification dispatcher", () => {
  const eventId = new Types.ObjectId();

  beforeEach(() => {
    mocks.eventFindOneAndUpdate.mockReset();
    mocks.eventUpdateOne.mockReset();
    mocks.deviceFind.mockReset();
    mocks.eventFindOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: eventId,
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
    expect(result).toEqual({ status: "sent", targetCount: 2, sentCount: 2, failedCount: 0 });
    expect(mocks.eventUpdateOne).toHaveBeenCalledWith(
      { _id: eventId, status: "processing" },
      expect.objectContaining({
        $set: expect.objectContaining({ status: "sent", sentCount: 2, failedCount: 0 })
      })
    );
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
