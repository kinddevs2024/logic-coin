import { describe, expect, it } from "vitest";
import { AVATAR_COLORS, avatarColor } from "../src/lib/avatar-color";

describe("account avatar colors", () => {
  it("keeps the same account color across sessions and separate views", () => {
    const id = "6aec91155a459c3c9d8c6ad4";
    const beforeRestart = JSON.stringify(avatarColor(id));
    const restoredId = JSON.parse(JSON.stringify({ id, name: "New display name" })).id;
    expect(JSON.stringify(avatarColor(restoredId))).toBe(beforeRestart);
  });

  it("distributes existing and newly created account IDs across all four colors", () => {
    const counts = new Map(AVATAR_COLORS.map(color => [color.background, 0]));
    for (let i = 0; i < 1000; i++) {
      const color = avatarColor(`6aec91155a459c3c${i.toString(16).padStart(8, "0")}`);
      counts.set(color.background, counts.get(color.background)! + 1);
    }
    for (const count of counts.values()) expect(count).toBeGreaterThan(150);
  });

  it("keeps initials legible against every assigned background", () => {
    function luminance(hex: string) {
      const rgb = hex.match(/[a-f\d]{2}/gi)!.map(part => {
        const c = parseInt(part, 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    }
    for (const color of AVATAR_COLORS) {
      const light = Math.max(luminance(color.background), luminance(color.foreground));
      const dark = Math.min(luminance(color.background), luminance(color.foreground));
      expect((light + 0.05) / (dark + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
