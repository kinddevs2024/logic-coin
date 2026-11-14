import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updatePreferences: vi.fn(),
  getDeviceId: vi.fn(),
  setPushStatus: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@/lib/native-runtime", () => ({ isExpoGo: true }));
vi.mock("@/lib/api", () => ({ devicesApi: { updatePreferences: mocks.updatePreferences } }));
vi.mock("@/lib/device-id", () => ({ getDeviceId: mocks.getDeviceId }));
vi.mock("@/lib/push-status", () => ({ setPushStatus: mocks.setPushStatus }));
vi.mock("expo-notifications", () => { throw new Error("Expo Go must not load native notifications"); });

import { configureDailyReminder, installNotificationHandlers, syncPushNotifications } from "../src/lib/notifications";

describe("Android Expo Go notification isolation", () => {
  it("does not import native notifications for reminders", async () => {
    expect(await configureDailyReminder(true, "19:00", "ru")).toBe(false);
    expect(await configureDailyReminder(false, "19:00", "ru")).toBe(true);
  });
  it("does not register tokens or change server preferences", async () => {
    expect(await syncPushNotifications({ accessToken: "test-only", enabled: true, reminderTime: "19:00" })).toBe(false);
    expect(mocks.getDeviceId).not.toHaveBeenCalled();
    expect(mocks.updatePreferences).not.toHaveBeenCalled();
    expect(mocks.setPushStatus).toHaveBeenCalledWith("setup_required");
  });
  it("installs a safe no-op cleanup without loading the SDK", async () => {
    const onOpen = vi.fn();
    const onToken = vi.fn();
    const cleanup = await installNotificationHandlers(onOpen, onToken);
    cleanup();
    expect(onOpen).not.toHaveBeenCalled();
    expect(onToken).not.toHaveBeenCalled();
  });
});
