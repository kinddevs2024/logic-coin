import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  permission: { status: "granted", canAskAgain: true },
  config: vi.fn(), nativeToken: vi.fn(),
  projectId: undefined as string | undefined,
  status: "local_only",
  updatePreferences: vi.fn(), list: vi.fn(),
  request: vi.fn(), token: vi.fn(), schedule: vi.fn(), channel: vi.fn(), dismiss: vi.fn(),
  presented: vi.fn(), response: vi.fn(), clearResponse: vi.fn(), openSettings: vi.fn(),
  getItem: vi.fn(), setItem: vi.fn(), handler: vi.fn(),
  scheduled: vi.fn(), cancelScheduled: vi.fn(),
  sendIntent: vi.fn(),
  respond: undefined as undefined | ((response: unknown) => void),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" }, Linking: { openSettings: mocks.openSettings, sendIntent: mocks.sendIntent }, AppState: { currentState: "active", addEventListener: () => ({ remove: vi.fn() }) } }));
vi.mock("@/lib/native-runtime", () => ({ isExpoGo: false }));
vi.mock("@/lib/api", () => ({ devicesApi: { pushConfig: mocks.config, updatePreferences: mocks.updatePreferences }, inboxApi: { list: mocks.list } }));
vi.mock("@/lib/device-id", () => ({ getDeviceId: async () => "test-device" }));
vi.mock("@/lib/push-status", () => ({ getPushStatus: () => mocks.status, setPushStatus: (status: string) => { mocks.status = status; } }));
vi.mock("expo-constants", () => ({ default: { get easConfig() { return { projectId: mocks.projectId }; } } }));
vi.mock("expo-application", () => ({ applicationId: "com.kinddevs.logiccoin" }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: mocks.getItem, setItem: mocks.setItem } }));
vi.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4, LOW: 2, DEFAULT: 3, NONE: 0 }, SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval", DAILY: "daily" },
  getPermissionsAsync: async () => mocks.permission,
  requestPermissionsAsync: mocks.request,
  getDevicePushTokenAsync: mocks.nativeToken,
  getExpoPushTokenAsync: mocks.token,
  setNotificationChannelAsync: mocks.channel,
  getPresentedNotificationsAsync: mocks.presented,
  dismissNotificationAsync: mocks.dismiss,
  scheduleNotificationAsync: mocks.schedule,
  getAllScheduledNotificationsAsync: mocks.scheduled,
  cancelScheduledNotificationAsync: mocks.cancelScheduled,
  setNotificationHandler: mocks.handler,
  addNotificationResponseReceivedListener: (callback: (response: unknown) => void) => { mocks.respond = callback; return { remove: vi.fn() }; },
  addPushTokenListener: () => ({ remove: vi.fn() }),
  getLastNotificationResponseAsync: mocks.response,
  clearLastNotificationResponseAsync: mocks.clearResponse,
}));

import { configureDailyReminder, dismissInboxNotifications, installNotificationHandlers, openNotificationSettings, startInboxNotificationSync, syncPushNotifications } from "../src/lib/notifications";

const input = { accessToken: "test-only", enabled: true, reminderTime: "19:00", requestPermission: true };
let cleanup: (() => void) | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.mockResolvedValue({ fcmEnabled: false });
  mocks.nativeToken.mockResolvedValue({ type: "android", data: "native-fcm-token" });
  mocks.permission = { status: "granted", canAskAgain: true };
  mocks.projectId = undefined; mocks.status = "local_only";
  mocks.updatePreferences.mockResolvedValue({}); mocks.presented.mockResolvedValue([]);
  mocks.getItem.mockResolvedValue(null); mocks.setItem.mockResolvedValue(undefined);
  mocks.response.mockResolvedValue(null); mocks.schedule.mockResolvedValue("scheduled");
  mocks.scheduled.mockResolvedValue([]);
  mocks.channel.mockResolvedValue(undefined);
  mocks.sendIntent.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue({ items: [], next: null });
});
afterEach(() => { cleanup?.(); cleanup = undefined; });

describe("native device notification permission and delivery", () => {
  it("replaces only its daily reminder without cancelling queued inbox notifications", async () => {
    mocks.scheduled.mockResolvedValue([
      { identifier: "logic-daily-reminder", content: { data: { logicDailyReminder: true } } },
      { identifier: "logic-inbox-event:test", content: { data: { inboxId: "event:000000000000000000000001" } } },
    ]);
    await configureDailyReminder(true, "19:00", "ru");
    expect(mocks.cancelScheduled.mock.calls).toEqual([["logic-daily-reminder"]]);
    expect(mocks.schedule).toHaveBeenCalledWith(expect.objectContaining({ identifier: "logic-daily-reminder" }));
  });
  it("asks OS permission without an EAS project and reports local-only capability honestly", async () => {
    mocks.permission = { status: "undetermined", canAskAgain: true };
    mocks.request.mockResolvedValue({ status: "granted" });
    expect(await syncPushNotifications(input)).toBe(true);
    expect(mocks.request).toHaveBeenCalledOnce();
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.status).toBe("local_only");
    expect(mocks.updatePreferences.mock.calls[0][1]).toMatchObject({ notificationsEnabled: true });
  });
  it("does not repeatedly prompt after denial, and can open app settings", async () => {
    mocks.permission = { status: "denied", canAskAgain: true };
    expect(await syncPushNotifications(input)).toBe(false);
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.status).toBe("denied");
    await openNotificationSettings();
    expect(mocks.sendIntent).toHaveBeenCalledWith("android.settings.APP_NOTIFICATION_SETTINGS", [{ key: "android.provider.extra.APP_PACKAGE", value: "com.kinddevs.logiccoin" }]);
  });
  it("falls back to general app settings on Android versions without the direct page", async () => {
    mocks.sendIntent.mockRejectedValue(new Error("unsupported intent"));
    await openNotificationSettings();
    expect(mocks.openSettings).toHaveBeenCalledOnce();
  });
  it("does not repeat a dismissed entry permission dialog, but allows an explicit retry", async () => {
    mocks.permission = { status: "undetermined", canAskAgain: true };
    mocks.getItem.mockResolvedValue("1");
    expect(await syncPushNotifications({ ...input, permissionOnEntry: true })).toBe(false);
    expect(mocks.request).not.toHaveBeenCalled();
    mocks.request.mockResolvedValue({ status: "granted" });
    expect(await syncPushNotifications(input)).toBe(true);
    expect(mocks.request).toHaveBeenCalledOnce();
  });
  it("recognizes a disabled Android message channel despite app-wide permission", async () => {
    mocks.channel.mockResolvedValue({ importance: 0 });
    expect(await syncPushNotifications(input)).toBe(false);
    expect(mocks.status).toBe("denied");
    expect(mocks.token).not.toHaveBeenCalled();
  });
  it("registers an actual Expo token when the owned project is configured", async () => {
    mocks.projectId = "test-project";
    mocks.token.mockResolvedValue({ data: "ExpoPushToken[test-only]" });
    await syncPushNotifications(input);
    expect(mocks.token).toHaveBeenCalledWith({ projectId: "test-project" });
    expect(mocks.status).toBe("ready");
  });
  it("does not show an Enable-permission prompt again after a registration network failure", async () => {
    mocks.projectId = "test-project";
    mocks.token.mockResolvedValue({ data: "ExpoPushToken[test-only]" });
    mocks.updatePreferences.mockRejectedValue(new Error("offline"));
    expect(await syncPushNotifications(input)).toBe(true);
    expect(mocks.status).toBe("local_only");
  });
  it("presents all 43 existing unread rows silently and persists delivery deduplication", async () => {
    const items = Array.from({ length: 43 }, (_, index) => ({ id: `event:${index.toString(16).padStart(24, "0")}`, title: "Message", body: "Body", read: false, kind: "event", createdAt: "2026-10-18T08:00:00Z" }));
    mocks.list.mockImplementation(async (_token, _all, cursor) => {
      const offset = Number(cursor?.id || 0);
      return { items: items.slice(offset, offset + 10), next: offset + 10 < items.length ? { date: "2026-10-18", id: String(offset + 10) } : null };
    });
    cleanup = await startInboxNotificationSync("test-only", "test-user");
    await vi.waitFor(() => expect(mocks.schedule).toHaveBeenCalledTimes(43));
    expect(mocks.schedule.mock.calls.every(([value]) => value.content.data.silent === true && value.content.sound === undefined)).toBe(true);
    await vi.waitFor(() => expect(mocks.setItem).toHaveBeenCalled());
    expect(JSON.parse(mocks.setItem.mock.calls.at(-1)![1])).toHaveLength(43);
  });
  it("preserves a newly arrived OS notification when read-all uses an earlier cutoff", async () => {
    const older = { date: 1, request: { identifier: "older", content: { data: { inboxId: "event:000000000000000000000001", createdAt: "2026-10-18T07:00:00Z" } } } };
    const newer = { date: 2, request: { identifier: "newer", content: { data: { inboxId: "event:000000000000000000000002", createdAt: "2026-10-18T09:00:00Z" } } } };
    mocks.presented.mockResolvedValue([older, newer]);
    await dismissInboxNotifications(undefined, "2026-10-18T08:00:00Z");
    expect(mocks.dismiss.mock.calls).toEqual([["older"]]);
  });
  it("passes only the tapped notification's inbox identity and retains failed-open receipts", async () => {
    const onOpen = vi.fn().mockRejectedValue(new Error("offline"));
    cleanup = await installNotificationHandlers(onOpen, vi.fn());
    mocks.respond!({ notification: { request: { content: { data: { inboxId: "gift:000000000000000000000001" } } } } });
    await vi.waitFor(() => expect(onOpen).toHaveBeenCalledWith(["gift:000000000000000000000001"]));
    expect(mocks.clearResponse).not.toHaveBeenCalled();
  });
});

it("registers direct FCM without an EAS project", async () => {
  mocks.config.mockResolvedValue({ fcmEnabled: true });
  await syncPushNotifications(input);
  expect(mocks.nativeToken).toHaveBeenCalledOnce();
  expect(mocks.token).not.toHaveBeenCalled();
  expect(mocks.updatePreferences).toHaveBeenCalledWith("test-device", expect.objectContaining({ fcmToken: "native-fcm-token", pushToken: null }), "test-only");
  expect(mocks.status).toBe("ready");
});
it("does not claim remote delivery when native Firebase setup is missing", async () => {
  mocks.config.mockResolvedValue({ fcmEnabled: true });
  mocks.nativeToken.mockRejectedValueOnce(new Error("not configured"));
  await syncPushNotifications(input);
  expect(mocks.status).toBe("local_only");
});
