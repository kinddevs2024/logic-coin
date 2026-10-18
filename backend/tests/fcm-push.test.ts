import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ configured: false }));
vi.mock("node:fs", () => ({ existsSync: () => mocks.configured }));
vi.mock("../src/config/env.js", () => ({ env: { FCM_SERVICE_ACCOUNT_FILE: "/protected/test-only.json" } }));
vi.mock("google-auth-library", () => ({ GoogleAuth: class { async getProjectId() { return "test-project"; } async getAccessToken() { return "test-only-oauth"; } } }));
import { fcmMessage, sendFcmPush } from "../src/services/fcm-push.service.js";

describe("FCM native notification contract", () => {
  it("uses an OS notification plus string-only routing data", () => {
    const result = fcmMessage("device-token", { title: "Gift", body: "Received", tag: "logic-1", data: { inboxId: "gift:1", createdAt: "2026-10-18", count: 2, dayKey: null } });
    expect(result.message.notification).toEqual({ title: "Gift", body: "Received" });
    expect(result.message.data).toMatchObject({ inboxId: "gift:1", createdAt: "2026-10-18", count: "2", tag: "logic-1" });
    expect(JSON.parse(result.message.data.body)).toMatchObject({ inboxId: "gift:1", count: 2 });
    expect(result.message.android.notification.channel_id).toBe("messages");
    expect(result.message.android.priority).toBe("HIGH");
  });
  it("does not silently accept an unconfigured sender", async () => {
    await expect(sendFcmPush("private-device-token", { title: "x", body: "y", tag: "z", data: {} })).rejects.toThrow("fcm:not_configured");
  });
});

it("uses authenticated HTTP v1 and recognizes invalid device tokens", async () => {
  mocks.configured = true;
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { details: [{ errorCode: "UNREGISTERED" }] } }) });
  expect(await sendFcmPush("device", { title: "x", body: "y", tag: "z", data: {} }, fetchMock as unknown as typeof fetch)).toBe("unregistered");
  expect(fetchMock.mock.calls[0]?.[0]).toBe("https://fcm.googleapis.com/v1/projects/test-project/messages:send");
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  await expect(sendFcmPush("device", { title: "x", body: "y", tag: "z", data: {} }, fetchMock as unknown as typeof fetch)).rejects.toThrow("fcm:delivery_error");
  mocks.configured = false;
});
