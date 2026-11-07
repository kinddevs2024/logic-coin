import { describe, expect, it } from "vitest";
import { editableUserProfile } from "../src/routes/admin-users.routes.js";
import { THEMES } from "../src/config/constants.js";

const profile = {
  name: "Test user", email: "qa@example.com", countryCode: "UZ", avatarUrl: "",
  preferences: { language: "uz", theme: "auto", savingsGoalCents: 1000,
    notificationsEnabled: true, dailyReminderEnabled: true, timezone: "Asia/Tashkent" },
  wallet: { availableUnits: 7 }, coins: { balance: 30485 },
};
describe("admin user editor compatibility", () => {
  it.each(THEMES)("accepts the app theme %s", theme => {
    expect(editableUserProfile.safeParse({ ...profile, preferences: { ...profile.preferences, theme } }).success).toBe(true);
  });
  it("round trips a photo theme with a profile edit", () => {
    const customTheme = { wallpaperUrl: "/api/v1/avatars/test.webp", accent: "#A9B8C9", dark: true };
    const input = { ...profile, preferences: { ...profile.preferences, theme: "custom", customTheme } };
    expect(editableUserProfile.parse(input).preferences.customTheme).toEqual(customTheme);
  });
  it("continues rejecting protected fields and invalid balances", () => {
    expect(editableUserProfile.safeParse({ ...profile, role: "admin" }).success).toBe(false);
    expect(editableUserProfile.safeParse({ ...profile, wallet: { availableUnits: -1 } }).success).toBe(false);
    expect(editableUserProfile.safeParse({ ...profile, wallet: { availableUnits: 7, lockedUnits: 0 } }).success).toBe(false);
  });
});
