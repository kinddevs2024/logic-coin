import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/api", () => ({ devicesApi: {} }));
vi.mock("@/lib/device-id", () => ({ getDeviceId: vi.fn() }));
vi.mock("@/lib/push-status", () => ({ setPushStatus: vi.fn() }));
import { deviceNotificationsPermitted } from "../src/lib/notifications.web";
afterEach(() => vi.unstubAllGlobals());
it("reads browser permission without prompting or registering a device", async () => {
  const requestPermission = vi.fn();
  for (const permission of ["granted", "denied", "default"]) {
    vi.stubGlobal("Notification", { permission, requestPermission });
    expect(await deviceNotificationsPermitted()).toBe(permission === "granted");
  }
  expect(requestPermission).not.toHaveBeenCalled();
});
it("handles browsers without the notifications API", async () => {
  vi.stubGlobal("Notification", undefined);
  expect(await deviceNotificationsPermitted()).toBe(false);
});
